import json
from collections.abc import Callable
from typing import Any, Literal, cast

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import END
from langgraph.types import Command
from pydantic import ValidationError

from app.domain.classification.models import JobClassificationDraft, TaxonomyOption
from app.graphs.classification.state import ClassificationState

ClassificationNode = Callable[[ClassificationState], Any]
LlmBuilder = Callable[[float], BaseChatModel]
MessageToText = Callable[[BaseMessage], str]


def prepare_taxonomy_prompt_node(state: ClassificationState) -> dict[str, str]:
    categories = _format_taxonomy_lines(state["categories"])
    skills = (
        _format_taxonomy_lines(state["skills"], include_parent=True)
        or "- None provided"
    )
    taxonomy_prompt = (
        "Available service categories:\n"
        f"{categories}\n\n"
        "Available skills:\n"
        f"{skills}\n"
    )
    return {"taxonomy_prompt": taxonomy_prompt}


def classify_with_model_node(
    state: ClassificationState,
    *,
    llm_builder: LlmBuilder,
    message_to_text: MessageToText,
    prompt_template: str,
    temperature: float,
) -> Command[Literal["parse_response", "__end__"]]:
    """Call the LLM with structured output. On success, skip parse_response and
    go straight to END. On structured-output failure, fall through to
    parse_response so the regex JSON salvage path can run.
    """
    llm = llm_builder(temperature)
    structured_llm = llm.with_structured_output(
        JobClassificationDraft,
        include_raw=True,
    )
    taxonomy_prompt = state.get("taxonomy_prompt", "")
    prompt = prompt_template.format(
        language=state["language"],
        title=state["title"],
        description=state["description"],
        taxonomy_prompt=taxonomy_prompt,
    )
    # Retry hint (if any) is appended to the prompt. The hint is set by the
    # confidence-gated edge before routing back into call_model - see
    # graph.py.
    retry_hint = state.get("retry_hint")
    if retry_hint:
        prompt = f"{prompt}\n\n{retry_hint}"
    attempts = state.get("attempts", 0) + 1
    response = cast(
        dict[str, Any],
        structured_llm.invoke(
            [
                SystemMessage(
                    content=(
                        "You are a reliable classifier for the Crafty Bass marketplace. "
                        "Never invent category or skill slugs that were not provided."
                    )
                ),
                HumanMessage(content=prompt),
            ]
        ),
    )

    parsed = response.get("parsed")
    raw_message = response.get("raw")
    raw_response = (
        message_to_text(raw_message) if isinstance(raw_message, BaseMessage) else ""
    )

    if isinstance(parsed, JobClassificationDraft):
        # Happy path: structured output succeeded. Skip the recovery node and
        # let the confidence gate decide whether to accept or re-classify.
        return Command(
            update={
                "parsed": parsed,
                "raw_response": raw_response or json.dumps(parsed.model_dump()),
                "attempts": attempts,
            },
            goto="confidence_gate",
        )

    # Unhappy path: hand the raw text to parse_response for salvage. The
    # confidence gate runs after that node too.
    return Command(
        update={
            "raw_response": raw_response,
            "attempts": attempts,
        },
        goto="parse_response",
    )


MAX_CLASSIFICATION_ATTEMPTS = 2
CONFIDENCE_ACCEPT_THRESHOLD = 0.7


def confidence_gate_node(
    state: ClassificationState,
) -> Command[Literal["call_model", "__end__"]]:
    """Decide whether the parsed classification is good enough, or whether to
    re-invoke call_model with a clarification hint.

    Returns a Command that either:
      - routes to END (accept the current `parsed`), or
      - routes back to "call_model" with `retry_hint` set, kicking off another
        attempt.

    Hard guard: never loop more than MAX_CLASSIFICATION_ATTEMPTS times - if the
    model still can't produce a confident answer by then, accept what we have
    and let the downstream normalizer apply its fallbacks. This is the
    skill-guide-recommended pattern from fix-infinite-loop-needs-exit.
    """
    parsed = state.get("parsed")
    attempts = state.get("attempts", 0)

    if not isinstance(parsed, JobClassificationDraft):
        # Defensive - parse_response should always populate `parsed`.
        return Command(goto=END)

    if attempts >= MAX_CLASSIFICATION_ATTEMPTS:
        return Command(goto=END)

    if parsed.confidence >= CONFIDENCE_ACCEPT_THRESHOLD and parsed.category_slug:
        return Command(goto=END)

    previous_slug = parsed.category_slug or "no category"
    retry_hint = (
        f"Your previous attempt picked '{previous_slug}' with confidence "
        f"{parsed.confidence:.2f}. If that slug is correct, raise your "
        "confidence and explain why in reasoning_summary. If it is not, pick "
        "the next-best slug from the provided list - do not invent new ones."
    )
    return Command(update={"retry_hint": retry_hint}, goto="call_model")


def parse_classification_response_node(
    state: ClassificationState,
) -> dict[str, JobClassificationDraft]:
    """Recovery path. We only reach here when structured output failed; the raw
    text is in state["raw_response"]. Try to salvage a JSON object from it.
    """
    payload = extract_json_block(state.get("raw_response", ""))
    try:
        parsed = JobClassificationDraft.model_validate_json(payload)
    except ValidationError:
        parsed = JobClassificationDraft(
            category_slug=None,
            skill_slugs=[],
            confidence=0.0,
            reasoning_summary=(
                "The model response could not be parsed into the expected schema."
            ),
        )
    return {"parsed": parsed}


def _format_taxonomy_lines(
    items: list[TaxonomyOption],
    *,
    include_parent: bool = False,
) -> str:
    lines: list[str] = []
    for item in items:
        parts = [f"- {item.slug}: {item.name}"]
        if include_parent and item.category_slug:
            parts.append(f"(category: {item.category_slug})")
        if item.description:
            parts.append(f"- {item.description}")
        lines.append(" ".join(parts))
    return "\n".join(lines)


def extract_json_block(raw_response: str) -> str:
    cleaned = raw_response.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end < start:
        return json.dumps(
            {
                "category_slug": None,
                "skill_slugs": [],
                "confidence": 0.0,
                "reasoning_summary": "The model did not return a JSON object.",
            }
        )
    return cleaned[start: end + 1]
