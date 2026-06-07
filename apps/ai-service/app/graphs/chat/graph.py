from typing import Any, cast

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph
from langgraph.types import RetryPolicy

from app.graphs.chat.nodes import ChatNode
from app.graphs.chat.state import ChatState

# Transient LLM failures (rate limits, 5xx, transient network) should not surface
# as 500s to the caller. Three attempts with exponential backoff is the
# skill-guide-recommended starting point for any LLM-calling node.
LLM_RETRY_POLICY = RetryPolicy(max_attempts=3, initial_interval=1.0)


def build_chat_graph(call_model: ChatNode) -> CompiledStateGraph[ChatState]:
    builder = StateGraph(ChatState)
    # LangGraph runtime accepts this callable, but static overload resolution
    # can be stricter with TypedDict-based node signatures.
    builder.add_node("call_model", cast(Any, call_model), retry_policy=LLM_RETRY_POLICY)
    builder.add_edge(START, "call_model")
    builder.add_edge("call_model", END)
    return builder.compile()
