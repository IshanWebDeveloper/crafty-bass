from typing import Literal

from pydantic import BaseModel, Field


class TaxonomyOption(BaseModel):
    slug: str = Field(min_length=1)
    name: str = Field(min_length=1)
    description: str | None = None
    category_slug: str | None = None


def _empty_taxonomy_option() -> list[TaxonomyOption]:
    return [TaxonomyOption(slug="", name="")]


class JobClassificationRequest(BaseModel):
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    language: Literal["EN", "SI", "TA"] = "EN"
    categories: list[TaxonomyOption] = Field(min_length=1)
    skills: list[TaxonomyOption] = Field(
        default_factory=_empty_taxonomy_option)


class JobClassificationDraft(BaseModel):
    category_slug: str | None = None
    skill_slugs: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    reasoning_summary: str = "No reasoning provided."


class JobClassificationResponse(JobClassificationDraft):
    model: str
    normalized_title: str
    raw_response: str


class JobClassificationBatchItem(BaseModel):
    """A single job in a batch request. `id` is echoed back on the response so
    the caller can correlate results without relying on list order."""

    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    language: Literal["EN", "SI", "TA"] = "EN"


class JobClassificationBatchRequest(BaseModel):
    """Batch classify request. Taxonomy is supplied once and shared across all
    items so the payload doesn't repeat it N times."""

    categories: list[TaxonomyOption] = Field(min_length=1)
    skills: list[TaxonomyOption] = Field(
        default_factory=_empty_taxonomy_option)
    items: list[JobClassificationBatchItem] = Field(min_length=1, max_length=50)


class JobClassificationBatchResult(BaseModel):
    id: str
    response: JobClassificationResponse


class JobClassificationBatchResponse(BaseModel):
    results: list[JobClassificationBatchResult]
