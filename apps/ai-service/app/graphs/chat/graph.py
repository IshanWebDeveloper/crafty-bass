from typing import Any, cast

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from app.graphs.chat.nodes import ChatNode
from app.graphs.chat.state import ChatState


def build_chat_graph(call_model: ChatNode) -> CompiledStateGraph[ChatState]:
    builder = StateGraph(ChatState)
    # LangGraph runtime accepts this callable, but static overload resolution
    # can be stricter with TypedDict-based node signatures.
    builder.add_node("call_model", cast(Any, call_model))
    builder.add_edge(START, "call_model")
    builder.add_edge("call_model", END)
    return builder.compile()
