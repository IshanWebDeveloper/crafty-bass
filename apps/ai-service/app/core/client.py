from typing import Optional

from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI

from app.core.config import get_settings


def get_llm(model: Optional[str] = None, temperature: Optional[float] = None):
    """Create and return an LLM instance based on `Settings`.

    - If `LLM_PROVIDER` is `openai` or `github`, returns `ChatOpenAI`.
    - Otherwise returns `ChatOllama`.
    """
    settings = get_settings()
    if temperature is None:
        temperature = settings.ollama_temperature

    provider = settings.llm_provider
    if provider == "openai":
        model_name = model or settings.openai_model
        return ChatOpenAI(
            model=model_name,
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
            temperature=temperature,
        )

    if provider == "github":
        model_name = model or settings.github_model_name

        # GitHub inference models may not support custom temperature values.
        # Omit the temperature parameter to avoid BadRequestError from the
        # provider when a non-default temperature is supplied.
        return ChatOpenAI(
            model=model_name,
            api_key=settings.github_token,
            base_url=settings.github_inference_endpoint,
        )

    # Default: Ollama
    model_name = model or settings.ollama_model
    return ChatOllama(model=model_name, base_url=settings.ollama_base_url, temperature=temperature)
