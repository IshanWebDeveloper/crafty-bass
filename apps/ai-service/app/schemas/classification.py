from typing import Literal

from pydantic import BaseModel, Field


class TaxonomyOption(BaseModel):
    slug: str = Field(min_length=1)
    name: str = Field(min_length=1)
    description: str | None = None
    category_slug: str | None = None


class JobClassificationRequest(BaseModel):
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    language: Literal["EN", "SI", "TA"] = "EN"
    categories: list[TaxonomyOption] = Field(min_length=1)
    skills: list[TaxonomyOption] = Field(default_factory=list)


class JobClassificationDraft(BaseModel):
    category_slug: str | None = None
    skill_slugs: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    reasoning_summary: str = "No reasoning provided."


class JobClassificationResponse(JobClassificationDraft):
    model: str
    normalized_title: str
    raw_response: str
