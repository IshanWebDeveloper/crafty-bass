from typing import Any, cast

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from app.graphs.classification.nodes import ClassificationNode
from app.graphs.classification.state import ClassificationState


def build_classification_graph(
    prepare_taxonomy: ClassificationNode,
    call_model: ClassificationNode,
    parse_response: ClassificationNode,
) -> CompiledStateGraph[ClassificationState]:
    builder = StateGraph(ClassificationState)
    # LangGraph runtime accepts these callables, but static overload resolution
    # can be stricter with TypedDict-based node signatures.
    builder.add_node("prepare_taxonomy", cast(Any, prepare_taxonomy))
    builder.add_node("call_model", cast(Any, call_model))
    builder.add_node("parse_response", cast(Any, parse_response))
    builder.add_edge(START, "prepare_taxonomy")
    builder.add_edge("prepare_taxonomy", "call_model")
    builder.add_edge("call_model", "parse_response")
    builder.add_edge("parse_response", END)
    return builder.compile()
