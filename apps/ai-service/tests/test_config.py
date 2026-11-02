import pytest
from pydantic import ValidationError

from app.core.config import Settings

KEY = {"LLM_PROVIDER": "anthropic", "ANTHROPIC_API_KEY": "test-key"}


def _settings(monkeypatch: pytest.MonkeyPatch, cors: str) -> Settings:
    for k, v in {**KEY, "CORS_ORIGINS": cors}.items():
        monkeypatch.setenv(k, v)
    return Settings(_env_file=None)


def test_cors_origins_accepts_comma_separated_form(monkeypatch: pytest.MonkeyPatch) -> None:
    # The form shipped in .env.example.
    s = _settings(monkeypatch, "http://localhost:3000, http://127.0.0.1:3000")
    assert s.cors_origins == ["http://localhost:3000", "http://127.0.0.1:3000"]


def test_cors_origins_accepts_json_array_form(monkeypatch: pytest.MonkeyPatch) -> None:
    s = _settings(monkeypatch, '["http://localhost:3000","http://admin.localhost:3001"]')
    assert s.cors_origins == ["http://localhost:3000", "http://admin.localhost:3001"]


def test_cors_origins_rejects_non_string_json(monkeypatch: pytest.MonkeyPatch) -> None:
    with pytest.raises(ValidationError):
        _settings(monkeypatch, "[1, 2]")
