from app.services.llm_graphs import LlmGraphService, get_llm_graph_service

GitHubGraphService = LlmGraphService


def get_github_graph_service() -> GitHubGraphService:
    return get_llm_graph_service()
