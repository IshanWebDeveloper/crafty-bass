from typing_extensions import NotRequired, TypedDict


class ChatState(TypedDict):
    system_prompt: str
    user_message: str
    temperature: float
    response: NotRequired[str]
