from typing import Any, cast

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph
from langgraph.types import RetryPolicy

from app.graphs.classification.nodes import ClassificationNode
from app.graphs.classification.state import ClassificationState

LLM_RETRY_POLICY = RetryPolicy(max_attempts=3, initial_interval=1.0)


def build_classification_graph(
    prepare_taxonomy: ClassificationNode,
    call_model: ClassificationNode,
    parse_response: ClassificationNode,
    confidence_gate: ClassificationNode,
) -> CompiledStateGraph[ClassificationState]:
    """Topology (per skills C + B — Command-driven + confidence loop):

        START → prepare_taxonomy → call_model ──┬─► confidence_gate ─► END
                                                │           │
                                                │           └─► call_model (retry)
                                                ▼
                                          parse_response ──► confidence_gate

    Two Command-driven branches converge on `confidence_gate`, which is itself
    a Command node that either ends the run or loops back into `call_model`
    with a retry_hint set. The loop is bounded by MAX_CLASSIFICATION_ATTEMPTS
    inside the gate (see fix-infinite-loop-needs-exit).
    """
    builder = StateGraph(ClassificationState)
    builder.add_node("prepare_taxonomy", cast(Any, prepare_taxonomy))
    builder.add_node(
        "call_model",
        cast(Any, call_model),
        retry_policy=LLM_RETRY_POLICY,
    )
    builder.add_node("parse_response", cast(Any, parse_response))
    builder.add_node("confidence_gate", cast(Any, confidence_gate))
    builder.add_edge(START, "prepare_taxonomy")
    builder.add_edge("prepare_taxonomy", "call_model")
    # No static edges out of call_model or confidence_gate — both use
    # Command(goto=...) to pick their successor dynamically.
    builder.add_edge("parse_response", "confidence_gate")
    return builder.compile()
