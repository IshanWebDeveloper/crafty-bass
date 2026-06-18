from app.domain.classification.models import JobClassificationDraft, TaxonomyOption


def normalize_classification(
    draft: JobClassificationDraft,
    categories: list[TaxonomyOption],
    skills: list[TaxonomyOption],
) -> JobClassificationDraft:
    allowed_categories = {item.slug for item in categories}
    skills_by_slug = {item.slug: item for item in skills}

    category_slug = draft.category_slug if draft.category_slug in allowed_categories else None

    skill_slugs: list[str] = []
    for slug in draft.skill_slugs:
        skill = skills_by_slug.get(slug)
        if skill is None:
            continue
        if category_slug and skill.category_slug and skill.category_slug != category_slug:
            continue
        if slug not in skill_slugs:
            skill_slugs.append(slug)

    confidence = draft.confidence if category_slug or skill_slugs else 0.0
    reasoning_summary = draft.reasoning_summary.strip() or "No reasoning provided."

    return JobClassificationDraft(
        category_slug=category_slug,
        skill_slugs=skill_slugs[:5],
        confidence=confidence,
        reasoning_summary=reasoning_summary,
    )
