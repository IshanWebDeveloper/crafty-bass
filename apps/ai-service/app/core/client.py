from langchain_anthropic import ChatAnthropic
from langchain_core.language_models import BaseChatModel
from langchain_openai import ChatOpenAI

from app.core.config import get_settings


def get_llm(model: str | None = None, temperature: float | None = None) -> BaseChatModel:
    """Create and return the configured chat client for Anthropic or OpenAI."""
    settings = get_settings()
    provider = settings.llm_provider
    selected_temperature = temperature if temperature is not None else settings.llm_temperature

    if provider == "openai":
        return ChatOpenAI(
            model=model or settings.openai_model,
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
            temperature=selected_temperature,
        )

    # Anthropic is both the default and the fallback branch, so an unrecognised
    # provider value cannot silently resolve to a different vendor.
    api_key = settings.anthropic_api_key
    if api_key is None:
        # Unreachable via `get_settings()`, whose validator rejects a blank key.
        # Guard anyway: ChatAnthropic would otherwise fall back to reading the
        # ambient ANTHROPIC_API_KEY and quietly bill a different account.
        raise RuntimeError("ANTHROPIC_API_KEY is not configured")

    # `model_name`, `max_tokens_to_sample` and `base_url` are the field aliases
    # langchain-anthropic exposes; they are what both pydantic and mypy expect.
    return ChatAnthropic(
        model_name=model or settings.anthropic_model,
        api_key=api_key,
        base_url=settings.anthropic_base_url,
        temperature=selected_temperature,
        max_tokens_to_sample=settings.llm_max_tokens,
        # No defaults in the generated __init__, so strict mypy requires them.
        timeout=None,
        stop=None,
    )
