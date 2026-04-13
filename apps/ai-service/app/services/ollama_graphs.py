from __future__ import annotations
import json
from functools import lru_cache
from typing import Any, cast

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph
from pydantic import ValidationError
from typing_extensions import NotRequired, TypedDict

from app.core.config import Settings, get_settings
from app.schemas.chat import ChatRequest, ChatResponse, ServiceInfo
from app.schemas.classification import (
    JobClassificationDraft,
    JobClassificationRequest,
    JobClassificationResponse,
    TaxonomyOption,
)


class ChatState(TypedDict):
    system_prompt: str
    user_message: str
    temperature: float
    response: NotRequired[str]


class ClassificationState(TypedDict):
    title: str
    description: str
    language: str
    categories: list[TaxonomyOption]
    skills: list[TaxonomyOption]
    taxonomy_prompt: NotRequired[str]
    raw_response: NotRequired[str]
    parsed: NotRequired[JobClassificationDraft]


class OllamaGraphService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.chat_graph = self._build_chat_graph()
        self.classification_graph = self._build_classification_graph()

    def service_info(self) -> ServiceInfo:
        return ServiceInfo(
            service=self.settings.app_name,
            environment=self.settings.app_env,
            llm_provider=self.settings.llm_provider,
            model=self._active_model(),
            base_url=self._active_base_url(),
        )

    def run_chat(self, request: ChatRequest) -> ChatResponse:
        state: ChatState = {
            "system_prompt": request.system_prompt,
            "user_message": request.message,
            "temperature": request.temperature or self.settings.ollama_temperature,

        }
        # FIX: Cast the result to ChatState to satisfy the type checker
        result = cast(ChatState, self.chat_graph.invoke(state))
        return ChatResponse(model=self._active_model(), response=result.get("response", ""))

    def classify_job(self, request: JobClassificationRequest) -> JobClassificationResponse:
        state: ClassificationState = {
            "title": request.title,
            "description": request.description,
            "language": request.language,
            "categories": request.categories,
            "skills": request.skills,
        }
        result = cast(ClassificationState,
                      self.classification_graph.invoke(state, stream_mode="messages"))
        normalized = self._normalize_classification(
            draft=result.get("parsed", JobClassificationDraft(
                category_slug=None,
                skill_slugs=[],
                confidence=0.0,
                reasoning_summary="No classification provided by the model.",
            )),
            categories=request.categories,
            skills=request.skills,
        )
        return JobClassificationResponse(
            model=self._active_model(),
            normalized_title=request.title.strip(),
            raw_response=result.get("raw_response", ""),
            **normalized.model_dump(),
        )

    def _build_chat_graph(self) -> CompiledStateGraph[ChatState]:
        builder = StateGraph(ChatState)
        builder.add_node("call_model", self._chat_with_model)
        builder.add_edge(START, "call_model")
        builder.add_edge("call_model", END)
        return builder.compile()

    def _build_classification_graph(self) -> CompiledStateGraph[ClassificationState]:
        builder = StateGraph(ClassificationState)
        builder.add_node("prepare_taxonomy", self._prepare_taxonomy_prompt)
        builder.add_node("call_model", self._classify_with_model)
        builder.add_node("parse_response", self._parse_classification_response)
        builder.add_edge(START, "prepare_taxonomy")
        builder.add_edge("prepare_taxonomy", "call_model")
        builder.add_edge("call_model", "parse_response")
        builder.add_edge("parse_response", END)
        return builder.compile()

    def _chat_with_model(self, state: ChatState) -> dict[str, str]:
        llm = self._build_llm(state["temperature"])
        response = llm.invoke(
            [
                SystemMessage(content=state["system_prompt"]),
                HumanMessage(content=state["user_message"]),
            ]
        )
        return {"response": self._message_to_text(response)}

    def _prepare_taxonomy_prompt(self, state: ClassificationState) -> dict[str, str]:
        categories = self._format_taxonomy_lines(state["categories"])
        skills = (
            self._format_taxonomy_lines(state["skills"], include_parent=True)
            or "- None provided"
        )
        taxonomy_prompt = (
            "Available service categories:\n"
            f"{categories}\n\n"
            "Available skills:\n"
            f"{skills}\n"
        )
        return {"taxonomy_prompt": taxonomy_prompt}

    def _classify_with_model(self, state: ClassificationState) -> dict[str, Any]:
        llm = self._build_llm(self.settings.ollama_temperature)
        structured_llm = llm.with_structured_output(
            JobClassificationDraft,
            include_raw=True,
        )
        taxonomy_prompt = state.get("taxonomy_prompt", "")
        prompt = (
            "Classify the home-services job request into exactly one of the provided "
            "categories when possible. Suggest up to five skills from the provided skills list.\n\n"
            f"Language: {state['language']}\n"
            f"Job title: {state['title']}\n"
            f"Job description: {state['description']}\n\n"
            f"{taxonomy_prompt}\n"
            "Return JSON only with this exact shape:\n"
            '{'
            '"category_slug": "string or null", '
            '"skill_slugs": ["skill-slug"], '
            '"confidence": 0.0, '
            '"reasoning_summary": "short explanation"'
            '}'
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
                reasoning_summary="The model response could not be parsed into the expected schema.",
            )

        raw_message = response.get("raw")
        raw_response = (
            self._message_to_text(raw_message)
            if isinstance(raw_message, BaseMessage)
            else json.dumps(parsed.model_dump())
        )
        return {
            "raw_response": raw_response,
            "parsed": parsed,
        }

    def _parse_classification_response(
        self,
        state: ClassificationState,
    ) -> dict[str, JobClassificationDraft]:
        if "parsed" in state:
            return {"parsed": state["parsed"]}

        payload = self._extract_json_block(state.get("raw_response", ""))
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

    def _build_llm(self, temperature: float) -> BaseChatModel:
        if self.settings.llm_provider == "openai":
            return ChatOpenAI(
                model=self.settings.openai_model,
                api_key=self.settings.openai_api_key,
                base_url=self.settings.openai_base_url,
                temperature=temperature,
            )
        if self.settings.llm_provider == "github":
            return ChatOpenAI(
                model=self.settings.github_model_name,
                api_key=self.settings.github_token,
                base_url=self.settings.github_inference_endpoint,
                temperature=temperature,
            )
        return ChatOllama(
            model=self.settings.ollama_model,
            base_url=self.settings.ollama_base_url,
            temperature=temperature,
        )

    def _active_model(self) -> str:
        if self.settings.llm_provider == "openai":
            return self.settings.openai_model
        if self.settings.llm_provider == "github":
            return self.settings.github_model_name
        return self.settings.ollama_model

    def _active_base_url(self) -> str | None:
        if self.settings.llm_provider == "openai":
            return self.settings.openai_base_url
        if self.settings.llm_provider == "github":
            return self.settings.github_inference_endpoint
        return self.settings.ollama_base_url

    def _normalize_classification(
        self,
        draft: JobClassificationDraft,
        categories: list[TaxonomyOption],
        skills: list[TaxonomyOption],
    ) -> JobClassificationDraft:
        allowed_categories = {item.slug for item in categories}
        skills_by_slug = {item.slug: item for item in skills}

        category_slug = draft.category_slug if draft.category_slug in allowed_categories else None

        skill_slugs: list[str] = []
        for slug in draft.skill_slugs:
            skill = skills_by_slug.get(slug)
            if skill is None:
                continue
            if category_slug and skill.category_slug and skill.category_slug != category_slug:
                continue
            if slug not in skill_slugs:
                skill_slugs.append(slug)

        confidence = draft.confidence if category_slug or skill_slugs else 0.0
        reasoning_summary = draft.reasoning_summary.strip() or "No reasoning provided."

        return JobClassificationDraft(
            category_slug=category_slug,
            skill_slugs=skill_slugs[:5],
            confidence=confidence,
            reasoning_summary=reasoning_summary,
        )

    @staticmethod
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

    @staticmethod
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

    @staticmethod
    def _extract_json_block(raw_response: str) -> str:
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


@lru_cache
def get_ollama_graph_service() -> OllamaGraphService:
    return OllamaGraphService(get_settings())
