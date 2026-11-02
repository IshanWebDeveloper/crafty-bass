import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


def _is_blank(secret: SecretStr | None) -> bool:
    """Treat an unset key and an empty `KEY=` line in .env as the same failure.

    Without this, copying .env.example without filling the key in yields an
    empty SecretStr that passes startup and fails later as an opaque 401.
    """
    return secret is None or not secret.get_secret_value().strip()


class Settings(BaseSettings):
    app_name: str = "Crafty Bass AI Service"
    app_env: str = "development"
    api_v1_str: str = "/api/v1"
    host: str = "127.0.0.1"
    port: int = 8006
    llm_provider: Literal["anthropic", "openai"] = "anthropic"
    # NoDecode: without it pydantic-settings JSON-decodes list fields before the
    # validator below runs, so the comma-separated form in .env.example crashed
    # startup with a SettingsError.
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: [
            "http://localhost:3000", "http://127.0.0.1:3000"]
    )
    openai_api_key: SecretStr | None = None
    openai_model: str = "gpt-4o-mini"
    openai_base_url: str | None = None
    anthropic_api_key: SecretStr | None = None
    anthropic_model: str = "claude-haiku-4-5"
    anthropic_base_url: str | None = None
    llm_temperature: float = Field(default=0.2, ge=0.0, le=1.0)
    # The Anthropic Messages API requires an output cap. langchain-anthropic
    # otherwise defaults it low enough to truncate chat and translation replies.
    llm_max_tokens: int = Field(default=4096, gt=0)
    better_auth_url: str | None = None
    jwt_audience: str | None = None
    jwt_issuer: str | None = None

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parents[2] / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        """Accept a JSON array or a comma-separated string."""
        if isinstance(value, list):
            return value
        text = value.strip()
        if text.startswith("["):
            parsed = json.loads(text)
            if not isinstance(parsed, list) or not all(isinstance(x, str) for x in parsed):
                raise ValueError("CORS_ORIGINS JSON must be an array of strings")
            return [x.strip() for x in parsed if x.strip()]
        return [item.strip() for item in text.split(",") if item.strip()]

    @model_validator(mode="after")
    def validate_llm_provider(self) -> "Settings":
        if self.llm_provider == "anthropic" and _is_blank(self.anthropic_api_key):
            raise ValueError(
                "ANTHROPIC_API_KEY must be set when LLM_PROVIDER=anthropic")
        if self.llm_provider == "openai" and _is_blank(self.openai_api_key):
            raise ValueError(
                "OPENAI_API_KEY must be set when LLM_PROVIDER=openai")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
