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
