from app.domain.classification.models import JobClassificationDraft, TaxonomyOption
from app.domain.classification.normalizer import normalize_classification

CATEGORIES = [
    TaxonomyOption(slug="plumbing", name="Plumbing"),
    TaxonomyOption(slug="electrical", name="Electrical"),
]
SKILLS = [
    TaxonomyOption(slug="pipe-fitting", name="Pipe fitting", category_slug="plumbing"),
    TaxonomyOption(slug="wiring", name="Wiring", category_slug="electrical"),
    TaxonomyOption(slug="general-labour", name="General labour", category_slug=None),
]


def _normalize(draft: JobClassificationDraft) -> JobClassificationDraft:
    return normalize_classification(draft, CATEGORIES, SKILLS)


def test_invalid_category_slug_is_dropped() -> None:
    result = _normalize(
        JobClassificationDraft(category_slug="not-a-real-slug", confidence=0.9)
    )
    assert result.category_slug is None


def test_valid_category_slug_is_preserved() -> None:
    result = _normalize(
        JobClassificationDraft(category_slug="plumbing", confidence=0.9)
    )
    assert result.category_slug == "plumbing"


def test_unknown_skill_is_dropped() -> None:
    result = _normalize(
        JobClassificationDraft(
            category_slug="plumbing",
            skill_slugs=["pipe-fitting", "does-not-exist"],
            confidence=0.9,
        )
    )
    assert result.skill_slugs == ["pipe-fitting"]


def test_category_mismatched_skill_dropped_but_uncategorised_kept() -> None:
    result = _normalize(
        JobClassificationDraft(
            category_slug="plumbing",
            # wiring belongs to electrical → dropped; general-labour has no
            # category → kept.
            skill_slugs=["wiring", "general-labour", "pipe-fitting"],
            confidence=0.9,
        )
    )
    assert result.skill_slugs == ["general-labour", "pipe-fitting"]


def test_duplicate_skills_are_deduped_preserving_order() -> None:
    result = _normalize(
        JobClassificationDraft(
            category_slug="plumbing",
            skill_slugs=["pipe-fitting", "general-labour", "pipe-fitting"],
            confidence=0.9,
        )
    )
    assert result.skill_slugs == ["pipe-fitting", "general-labour"]


def test_skills_are_capped_at_five() -> None:
    skills = [
        TaxonomyOption(slug=f"skill-{i}", name=f"Skill {i}", category_slug=None)
        for i in range(7)
    ]
    result = normalize_classification(
        JobClassificationDraft(
            category_slug="plumbing",
            skill_slugs=[s.slug for s in skills],
            confidence=0.9,
        ),
        CATEGORIES,
        skills,
    )
    assert len(result.skill_slugs) == 5


def test_confidence_is_zeroed_when_nothing_survives() -> None:
    result = _normalize(
        JobClassificationDraft(
            category_slug="not-real",
            skill_slugs=["also-not-real"],
            confidence=0.95,
        )
    )
    assert result.category_slug is None
    assert result.skill_slugs == []
    assert result.confidence == 0.0


def test_blank_reasoning_gets_a_default() -> None:
    result = _normalize(
        JobClassificationDraft(
            category_slug="plumbing",
            confidence=0.9,
            reasoning_summary="   ",
        )
    )
    assert result.reasoning_summary == "No reasoning provided."
