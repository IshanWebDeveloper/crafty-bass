import operator
from typing_extensions import Annotated, TypedDict

from app.schemas.classification import (
    JobClassificationBatchItem,
    JobClassificationBatchResult,
    TaxonomyOption,
)


class BatchClassificationState(TypedDict):
    """State for the batch classification graph.

    - `items`, `categories`, `skills` are read-only inputs.
    - `results` must use the `operator.add` reducer because workers run in
      parallel and each returns a single-element list. Without the reducer,
      LangGraph would apply last-write-wins and only one worker's result would
      survive — the textbook fix-send-accumulator bug.
    """

    items: list[JobClassificationBatchItem]
    categories: list[TaxonomyOption]
    skills: list[TaxonomyOption]
    results: Annotated[list[JobClassificationBatchResult], operator.add]


class WorkerInput(TypedDict):
    """The payload each Send() hands to a worker."""

    id: str
    item: JobClassificationBatchItem
    categories: list[TaxonomyOption]
    skills: list[TaxonomyOption]
