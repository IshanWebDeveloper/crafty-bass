from collections.abc import Callable
from typing import Any, cast

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph
from langgraph.types import RetryPolicy, Send

from app.graphs.batch_classification.state import BatchClassificationState, WorkerInput
from app.schemas.classification import (
    JobClassificationBatchResult,
    JobClassificationRequest,
    JobClassificationResponse,
)

# Single-job classifier supplied by the service layer at build time. Decoupling
# the worker from the orchestrator lets tests substitute a fake classifier.
SingleClassifier = Callable[[JobClassificationRequest], JobClassificationResponse]

LLM_RETRY_POLICY = RetryPolicy(max_attempts=3, initial_interval=1.0)


def build_batch_classification_graph(
    classify_one: SingleClassifier,
) -> CompiledStateGraph[BatchClassificationState]:
    """Topology:

        START → (orchestrator: Send * N) → worker (×N parallel) → synthesize → END

    The orchestrator returns a list of `Send("worker", payload)` instructions,
    one per item. LangGraph then schedules workers in parallel; their `results`
    fragments are merged via the `operator.add` reducer on state.
    """

    def orchestrator(state: BatchClassificationState) -> list[Send]:
        return [
            Send(
                "worker",
                cast(
                    Any,
                    WorkerInput(
                        id=item.id,
                        item=item,
                        categories=state["categories"],
                        skills=state["skills"],
                    ),
                ),
            )
            for item in state["items"]
        ]

    def worker(payload: WorkerInput) -> dict[str, list[JobClassificationBatchResult]]:
        request = JobClassificationRequest(
            title=payload["item"].title,
            description=payload["item"].description,
            language=payload["item"].language,
            categories=payload["categories"],
            skills=payload["skills"],
        )
        response = classify_one(request)
        # Return a single-element list - the reducer concatenates across workers.
        return {
            "results": [
                JobClassificationBatchResult(id=payload["id"], response=response)
            ]
        }

    def synthesize(
        state: BatchClassificationState,
    ) -> dict[str, list[JobClassificationBatchResult]]:
        # Preserve caller-supplied order so the response array matches the
        # request order regardless of which workers finished first.
        order = {item.id: index for index, item in enumerate(state["items"])}
        ordered = sorted(state["results"], key=lambda result: order.get(result.id, 0))
        return {"results": ordered}

    builder = StateGraph(BatchClassificationState)
    builder.add_node("worker", cast(Any, worker), retry_policy=LLM_RETRY_POLICY)
    builder.add_node("synthesize", cast(Any, synthesize))
    # Conditional edge from START dispatches the Send list; the third arg is the
    # set of valid destinations so LangGraph can validate at compile time.
    builder.add_conditional_edges(START, cast(Any, orchestrator), ["worker"])
    builder.add_edge("worker", "synthesize")
    builder.add_edge("synthesize", END)
    return builder.compile()
