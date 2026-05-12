from __future__ import annotations

from collections.abc import Iterator
from functools import lru_cache
from typing import Any, cast

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage

from app.core.config import Settings, get_settings
from app.domain.classification.normalizer import normalize_classification
from app.graphs.chat.graph import build_chat_graph
from app.graphs.chat.nodes import call_model_node
from app.graphs.chat.state import ChatState
from app.graphs.classification.graph import build_classification_graph
from app.graphs.classification.nodes import (
    classify_with_model_node,
    parse_classification_response_node,
    prepare_taxonomy_prompt_node,
)
from app.graphs.classification.state import ClassificationState
from app.infrastructure.llm.factory import get_llm
from app.infrastructure.prompts.classification import classification_template
from app.schemas.chat import ChatRequest, ChatResponse, ServiceInfo
from app.schemas.classification import (
    JobClassificationDraft,
    JobClassificationRequest,
    JobClassificationResponse,
)


class LlmGraphService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.chat_graph = build_chat_graph(self._chat_with_model)
        self.classification_graph = build_classification_graph(
            self._prepare_taxonomy_prompt,
            self._classify_with_model,
            self._parse_classification_response,
        )

    def service_info(self) -> ServiceInfo:
        return ServiceInfo(
            service=self.settings.app_name,
            environment=self.settings.app_env,
            llm_provider=self.settings.llm_provider,
            model=self._active_model(),
            base_url=self._active_base_url(),
        )

    def run_chat(self, request: ChatRequest) -> ChatResponse:
        temperature = (
            request.temperature
            if request.temperature is not None
            else self.settings.llm_temperature
        )
        state: ChatState = {
            "system_prompt": request.system_prompt,
            "user_message": request.message,
            "temperature": temperature,
        }
        result = cast(ChatState, self.chat_graph.invoke(state))
        return ChatResponse(model=self._active_model(), response=result.get("response", ""))

    def stream_chat(self, request: ChatRequest) -> Iterator[dict[str, Any]]:
        """Stream state updates from the chat graph as dicts suitable for SSE.

        Uses `stream_mode='values'` to emit the full state after each graph step.
        """
        temperature = (
            request.temperature
            if request.temperature is not None
            else self.settings.llm_temperature
        )
        state: ChatState = {
            "system_prompt": request.system_prompt,
            "user_message": request.message,
            "temperature": temperature,
        }
        stream_values = cast(
            Iterator[object],
            self.chat_graph.stream(state, stream_mode="values"),
        )
        for value in stream_values:
            if isinstance(value, dict):
                yield value
                continue
            if isinstance(value, tuple):
                tuple_value = cast(tuple[object, ...], value)
                if not tuple_value:
                    yield {"response": ""}
                    continue
                token = tuple_value[0]
                if isinstance(token, BaseMessage):
                    yield {"response": self._message_to_text(token)}
                    continue
                token_content = getattr(token, "content", None)
                if token_content is not None:
                    yield {"response": str(token_content)}
                    continue
                yield {"response": str(tuple_value)}
                continue
            yield {"response": str(value)}

    def classify_job(self, request: JobClassificationRequest) -> JobClassificationResponse:
        state: ClassificationState = {
            "title": request.title,
            "description": request.description,
            "language": request.language,
            "categories": request.categories,
            "skills": request.skills,
        }
        # Run the graph synchronously (no streaming) so we receive the final
        # compiled state with `parsed` and `raw_response` set by nodes.
        result = cast(ClassificationState,
                      self.classification_graph.invoke(state))
        normalized = normalize_classification(
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

    def _chat_with_model(self, state: ChatState) -> dict[str, str]:
        return call_model_node(
            state,
            llm_builder=self._build_llm,
            message_to_text=self._message_to_text,
        )

    def _prepare_taxonomy_prompt(self, state: ClassificationState) -> dict[str, str]:
        return prepare_taxonomy_prompt_node(state)

    def _classify_with_model(self, state: ClassificationState) -> dict[str, Any]:
        return classify_with_model_node(
            state,
            llm_builder=self._build_llm,
            message_to_text=self._message_to_text,
            prompt_template=classification_template,
            temperature=self.settings.llm_temperature,
        )

    def _parse_classification_response(
        self,
        state: ClassificationState,
    ) -> dict[str, JobClassificationDraft]:
        return parse_classification_response_node(state)

    def _build_llm(self, temperature: float) -> BaseChatModel:
        return get_llm(temperature=temperature)

    def _active_model(self) -> str:
        if self.settings.llm_provider == "openai":
            return self.settings.openai_model
        return self.settings.github_model_name

    def _active_base_url(self) -> str | None:
        if self.settings.llm_provider == "openai":
            return self.settings.openai_base_url
        return self.settings.github_inference_endpoint

    @staticmethod
    def _message_to_text(message: BaseMessage) -> str:
        raw_content: object = cast(object, message.content)
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


@lru_cache
def get_llm_graph_service() -> LlmGraphService:
    return LlmGraphService(get_settings())
