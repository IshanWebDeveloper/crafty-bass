from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    system_prompt: str = Field(
        default=(
            "You are the Crafty Bass AI assistant. Give concise, practical responses "
            "for a Sri Lankan home-services marketplace team."
        )
    )
    temperature: float | None = Field(default=None, ge=0.0, le=1.0)


class ChatResponse(BaseModel):
    model: str
    response: str


class ServiceInfo(BaseModel):
    service: str
    environment: str
    llm_provider: str
    model: str
    base_url: str | None = None
