from app.services.llm_graphs import LlmGraphService, get_llm_graph_service

AssistantService = LlmGraphService


def get_assistant_service() -> AssistantService:
    return get_llm_graph_service()
