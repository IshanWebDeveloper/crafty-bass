from __future__ import annotations

import json
from typing import Optional, Any, TypedDict, cast, Callable

from langchain_core.output_parsers import StrOutputParser
from langchain_core.messages import BaseMessage
from langchain_core.runnables import Runnable
from .client import get_llm
from .prompts import chat_prompt, classification_template
from app.schemas.chat import ChatRequest, ChatResponse
from app.schemas.classification import (
    JobClassificationDraft,
    JobClassificationRequest,
    JobClassificationResponse,
    TaxonomyOption,
)
from app.core.config import get_settings


class RawClassificationOutput(TypedDict):
    parsed: JobClassificationDraft | None
    raw: BaseMessage
    parsing_error: Any


def build_chat_chain(model: Optional[str] = None, temperature: Optional[float] = None) -> Runnable[ChatRequest, str]:
    """Build a chat chain.

    If `model` is None the configured provider default from `Settings` is used.
    """
    llm = get_llm(model=model, temperature=temperature)
    chain = cast(Runnable[ChatRequest, str],
                 chat_prompt | llm | StrOutputParser())
    return chain


def ask(question: str, context: str = "") -> str:
    chain = build_chat_chain()
    return chain.invoke(ChatRequest(message=question, system_prompt=context))


def run_chat(request: ChatRequest) -> ChatResponse:
    """Run a chat request using the configured provider and return a `ChatResponse`.

    Uses `Settings` to report the active model in the response.
    """
    chain = build_chat_chain(model=None, temperature=request.temperature)
    text = chain.invoke(
        ChatRequest(message=request.message,
                    system_prompt=request.system_prompt)
    )
    settings = get_settings()
    model = (
        settings.openai_model
        if settings.llm_provider == "openai"
        else settings.github_model_name
        if settings.llm_provider == "github"
        else settings.ollama_model
    )
    return ChatResponse(model=model, response=text)


def build_classification_chain(model: Optional[str] = None, temperature: Optional[float] = None) -> Callable[[str, str, str, Optional[str]], Any]:
    """Return a callable that runs the classification LLM with structured output.

    The returned callable has signature `(title, description, language, taxonomy_prompt) -> dict`.
    """
    llm = get_llm(model=model, temperature=temperature)
    structured = cast(
        Runnable[str, RawClassificationOutput],
        llm.with_structured_output(JobClassificationDraft, include_raw=True),
    )

    def classify(title: str, description: str, language: str, taxonomy_prompt: str | None = None) -> Any:
        taxonomy_prompt = taxonomy_prompt or ""
        prompt = classification_template.format(
            language=language,
            title=title,
            description=description,
            taxonomy_prompt=taxonomy_prompt,
        )
        return structured.invoke(prompt)

    return classify


def _format_taxonomy_lines(items: list[TaxonomyOption], include_parent: bool = False) -> str:
    lines: list[str] = []
    for item in items:
        parts = [f"- {item.slug}: {item.name}"]
        if include_parent and item.category_slug:
            parts.append(f"(category: {item.category_slug})")
        if item.description:
            parts.append(f"- {item.description}")
        lines.append(" ".join(parts))
    return "\n".join(lines)


def run_classification(request: JobClassificationRequest) -> JobClassificationResponse:
    """Run classification for a `JobClassificationRequest` and return `JobClassificationResponse`.

    This duplicates the normalization logic used elsewhere so callers can use the schema types.
    """
    classify = build_classification_chain()

    categories = _format_taxonomy_lines(request.categories)
    skills = _format_taxonomy_lines(
        request.skills, include_parent=True) or "- None provided"

    taxonomy_prompt = f"Available service categories:\n{categories}\n\nAvailable skills:\n{skills}\n"

    response: RawClassificationOutput = classify(request.title, request.description,
                                                 request.language, taxonomy_prompt)

    parsed: JobClassificationDraft = response["parsed"] or JobClassificationDraft(
        category_slug=None,
        skill_slugs=[],
        confidence=0.0,
        reasoning_summary="The model response could not be parsed into the expected schema.",
    )

    raw_message: BaseMessage = response["raw"]
    raw_response: str = _message_to_text(
        raw_message) or json.dumps(response["raw"], default=str)

    # Normalize classification (same logic as OllamaGraphService._normalize_classification)
    allowed_categories = {item.slug for item in request.categories}
    skills_by_slug = {item.slug: item for item in request.skills}

    category_slug = parsed.category_slug if parsed.category_slug in allowed_categories else None

    skill_slugs: list[str] = []
    for slug in parsed.skill_slugs:
        skill = skills_by_slug.get(slug)
        if skill is None:
            continue
        if category_slug and skill.category_slug and skill.category_slug != category_slug:
            continue
        if slug not in skill_slugs:
            skill_slugs.append(slug)

    confidence = parsed.confidence if category_slug or skill_slugs else 0.0
    reasoning_summary = parsed.reasoning_summary.strip() or "No reasoning provided."

    settings = get_settings()
    model = (
        settings.openai_model
        if settings.llm_provider == "openai"
        else settings.github_model_name
        if settings.llm_provider == "github"
        else settings.ollama_model
    )

    return JobClassificationResponse(
        model=model,
        normalized_title=request.title.strip(),
        raw_response=raw_response,
        category_slug=category_slug,
        skill_slugs=skill_slugs[:5],
        confidence=confidence,
        reasoning_summary=reasoning_summary,
    )


def _message_to_text(message: BaseMessage) -> str:
    raw_content: object = message.content  # type: ignore
    if isinstance(raw_content, str):
        return raw_content.strip()

    content = cast(list[str | dict[str, Any]], raw_content)

    chunks: list[str] = []
    for item in content:
        if isinstance(item, dict):
            text = item.get("text")
            chunks.append(str(text) if text is not None else str(item))
            continue
        chunks.append(str(item))

    return "\n".join(chunk.strip() for chunk in chunks if chunk).strip()
