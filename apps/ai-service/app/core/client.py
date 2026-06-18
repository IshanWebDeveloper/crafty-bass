from langchain_openai import ChatOpenAI

from app.core.config import get_settings


def get_llm(model: str | None = None, temperature: float | None = None) -> ChatOpenAI:
    """Create and return the configured chat client for GitHub or OpenAI."""
    settings = get_settings()
    provider = settings.llm_provider
    selected_temperature = temperature if temperature is not None else settings.llm_temperature

    if provider == "openai":
        model_name = model or settings.openai_model
        api_key = settings.openai_api_key
        return ChatOpenAI(
            model=model_name,
            api_key=api_key,
            base_url=settings.openai_base_url,
            temperature=selected_temperature,
        )

    model_name = model or settings.github_model_name
    api_key = settings.github_token
    # GitHub Models compatibility can vary by model for temperature support.
    # We intentionally omit temperature to avoid provider-side BadRequest errors.
    return ChatOpenAI(
        model=model_name,
        api_key=api_key,
        base_url=settings.github_inference_endpoint,
    )
