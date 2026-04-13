from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Crafty Bass AI Servicesssss"
    app_env: str = "development"
    api_v1_str: str = "/api/v1"
    host: str = "127.0.0.1"
    port: int = 8006
    llm_provider: Literal["ollama", "openai", "github"] = "github"
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000", "http://127.0.0.1:3000"]
    )
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "llama3.1:8b"
    openai_api_key: SecretStr | None = None
    github_token: SecretStr | None = None
    github_inference_endpoint: str = "https://models.github.ai/inference"
    github_model_name: str = "openai/gpt-4o-mini"
    openai_model: str = "gpt-4o-mini"
    openai_base_url: str | None = None
    ollama_temperature: float = Field(default=0.2, ge=0.0, le=1.0)

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parents[2] / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, list):
            return value
        return [item.strip() for item in value.split(",") if item.strip()]

    @model_validator(mode="after")
    def validate_llm_provider(self) -> "Settings":
        if self.llm_provider == "openai" and self.openai_api_key is None:
            raise ValueError(
                "OPENAI_API_KEY must be set when LLM_PROVIDER=openai")
        if self.llm_provider == "github" and self.github_token is None:
            raise ValueError(
                "GITHUB_TOKEN must be set when LLM_PROVIDER=github")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
