from pydantic import BaseModel, Field


class TranslateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    # Human-readable target language name (e.g. "Sinhala", "Tamil", "English").
    # The caller maps its locale to a name so the prompt stays robust.
    target_language: str = Field(min_length=1, max_length=40)
    # Optional hint; the model auto-detects when omitted.
    source_language: str | None = Field(default=None, max_length=40)


class TranslateResponse(BaseModel):
    model: str
    translated_text: str
