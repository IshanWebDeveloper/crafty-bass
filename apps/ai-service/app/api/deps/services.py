from app.services.assistant_service import AssistantService
from app.services.assistant_service import get_assistant_service as _get_assistant_service


def get_assistant_service() -> AssistantService:
    return _get_assistant_service()
