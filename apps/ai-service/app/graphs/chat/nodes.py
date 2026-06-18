from collections.abc import Callable

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage

from app.graphs.chat.state import ChatState

ChatNode = Callable[[ChatState], dict[str, str]]
LlmBuilder = Callable[[float], BaseChatModel]
MessageToText = Callable[[BaseMessage], str]


def call_model_node(
    state: ChatState,
    *,
    llm_builder: LlmBuilder,
    message_to_text: MessageToText,
) -> dict[str, str]:
    llm = llm_builder(state["temperature"])
    response = llm.invoke(
        [
            SystemMessage(content=state["system_prompt"]),
            HumanMessage(content=state["user_message"]),
        ]
    )
    return {"response": message_to_text(response)}
