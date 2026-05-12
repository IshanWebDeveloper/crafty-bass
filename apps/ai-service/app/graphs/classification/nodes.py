import json
from collections.abc import Callable
from typing import Any, cast

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from pydantic import ValidationError

from app.domain.classification.models import JobClassificationDraft, TaxonomyOption
from app.graphs.classification.state import ClassificationState

ClassificationNode = Callable[[ClassificationState], dict[str, Any]]
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
) -> dict[str, Any]:
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
    if not isinstance(parsed, JobClassificationDraft):
        parsed = JobClassificationDraft(
            category_slug=None,
            skill_slugs=[],
            confidence=0.0,
            reasoning_summary=(
                "The model response could not be parsed into the expected schema."
            ),
        )

    raw_message = response.get("raw")
    raw_response = (
        message_to_text(raw_message)
        if isinstance(raw_message, BaseMessage)
        else json.dumps(parsed.model_dump())
    )
    return {
        "raw_response": raw_response,
        "parsed": parsed,
    }


def parse_classification_response_node(
    state: ClassificationState,
) -> dict[str, JobClassificationDraft]:
    if "parsed" in state:
        return {"parsed": state["parsed"]}

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
