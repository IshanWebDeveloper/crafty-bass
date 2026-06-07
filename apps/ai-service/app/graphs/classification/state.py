from typing_extensions import NotRequired, TypedDict

from app.domain.classification.models import JobClassificationDraft, TaxonomyOption


class ClassificationState(TypedDict):
    title: str
    description: str
    language: str
    categories: list[TaxonomyOption]
    skills: list[TaxonomyOption]
    taxonomy_prompt: NotRequired[str]
    raw_response: NotRequired[str]
    parsed: NotRequired[JobClassificationDraft]
    # Loop bookkeeping for the confidence-gated retry. `attempts` counts how
    # many times call_model has run; `retry_hint` is appended to the prompt on
    # subsequent attempts to nudge the model toward a more decisive answer.
    attempts: NotRequired[int]
    retry_hint: NotRequired[str]
