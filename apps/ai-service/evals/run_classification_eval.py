"""Offline evaluation harness for the job-classification graph.

Runs the *real* classification service (the same entry point the
`/classify-job` route calls) over a hand-labelled dataset and reports how well
it recovers the expected category and skills. All metrics are computed in pure
Python (no sklearn) so the harness has no extra runtime dependencies.

Usage (from apps/ai-service, with the venv active and an LLM key in .env):

    python -m evals.run_classification_eval                 # full dataset
    python -m evals.run_classification_eval --limit 3       # quick smoke run
    python -m evals.run_classification_eval --out ./results # custom output dir

Outputs a timestamped JSON (full metrics + per-item predictions) and CSV
(per-item rows) under evals/results/.
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.schemas.classification import JobClassificationRequest, TaxonomyOption
from app.services.assistant_service import get_assistant_service

EVALS_DIR = Path(__file__).resolve().parent
DATASET_DIR = EVALS_DIR / "dataset"
RESULTS_DIR = EVALS_DIR / "results"


def _load_taxonomy() -> tuple[list[TaxonomyOption], list[TaxonomyOption]]:
    data = json.loads((DATASET_DIR / "taxonomy.json").read_text(encoding="utf-8"))
    categories = [TaxonomyOption(**c) for c in data["categories"]]
    skills = [TaxonomyOption(**s) for s in data["skills"]]
    return categories, skills


def _load_dataset() -> list[dict[str, Any]]:
    return json.loads(
        (DATASET_DIR / "classification_labelled.json").read_text(encoding="utf-8")
    )


def _jaccard(predicted: list[str], expected: list[str]) -> float:
    pred, exp = set(predicted), set(expected)
    if not pred and not exp:
        return 1.0
    union = pred | exp
    return len(pred & exp) / len(union) if union else 0.0


def _prf(tp: int, fp: int, fn: int) -> dict[str, float]:
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = (
        2 * precision * recall / (precision + recall)
        if (precision + recall)
        else 0.0
    )
    return {"precision": precision, "recall": recall, "f1": f1}


def run(limit: int | None = None) -> dict[str, Any]:
    categories, skills = _load_taxonomy()
    dataset = _load_dataset()
    if limit is not None:
        dataset = dataset[:limit]

    service = get_assistant_service()

    rows: list[dict[str, Any]] = []
    for item in dataset:
        request = JobClassificationRequest(
            title=item["title"],
            description=item["description"],
            language=item["language"],
            categories=categories,
            skills=skills,
        )
        response = service.classify_job(request)
        predicted_category = response.category_slug
        predicted_skills = list(response.skill_slugs)
        rows.append(
            {
                "id": item["id"],
                "language": item["language"],
                "ambiguous": item["ambiguous"],
                "expected_category": item["expected_category"],
                "predicted_category": predicted_category,
                "correct": predicted_category == item["expected_category"],
                "confidence": round(float(response.confidence), 4),
                "expected_skills": item["expected_skills"],
                "predicted_skills": predicted_skills,
                "skill_jaccard": round(
                    _jaccard(predicted_skills, item["expected_skills"]), 4
                ),
            }
        )

    return _summarise(rows)


def _summarise(rows: list[dict[str, Any]]) -> dict[str, Any]:
    total = len(rows)
    correct = sum(1 for r in rows if r["correct"])

    # Per-category precision / recall / F1.
    tp: dict[str, int] = defaultdict(int)
    fp: dict[str, int] = defaultdict(int)
    fn: dict[str, int] = defaultdict(int)
    confusion: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for r in rows:
        exp, pred = r["expected_category"], r["predicted_category"]
        confusion[exp][pred or "<none>"] += 1
        if pred == exp:
            tp[exp] += 1
        else:
            fn[exp] += 1
            if pred:
                fp[pred] += 1

    labels = sorted({r["expected_category"] for r in rows} | set(fp))
    per_category = {
        label: {**_prf(tp[label], fp[label], fn[label]), "support": tp[label] + fn[label]}
        for label in labels
    }
    macro_f1 = (
        sum(v["f1"] for v in per_category.values()) / len(per_category)
        if per_category
        else 0.0
    )

    # Confidence calibration by decile: accuracy vs mean confidence per bucket.
    buckets: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for r in rows:
        idx = min(9, int(r["confidence"] * 10))
        buckets[idx].append(r)
    calibration = [
        {
            "bucket": f"{i / 10:.1f}-{(i + 1) / 10:.1f}",
            "count": len(buckets[i]),
            "mean_confidence": round(
                sum(r["confidence"] for r in buckets[i]) / len(buckets[i]), 4
            ),
            "accuracy": round(
                sum(1 for r in buckets[i] if r["correct"]) / len(buckets[i]), 4
            ),
        }
        for i in range(10)
        if buckets[i]
    ]

    # Accuracy by language.
    by_lang: dict[str, dict[str, int]] = defaultdict(lambda: {"total": 0, "correct": 0})
    for r in rows:
        by_lang[r["language"]]["total"] += 1
        by_lang[r["language"]]["correct"] += 1 if r["correct"] else 0
    language_accuracy = {
        lang: round(v["correct"] / v["total"], 4) for lang, v in by_lang.items()
    }

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "n": total,
        "overall": {
            "category_accuracy_micro": round(correct / total, 4) if total else 0.0,
            "category_f1_macro": round(macro_f1, 4),
            "mean_skill_jaccard": round(
                sum(r["skill_jaccard"] for r in rows) / total, 4
            )
            if total
            else 0.0,
        },
        "language_accuracy": language_accuracy,
        "per_category": per_category,
        "confusion_matrix": {k: dict(v) for k, v in confusion.items()},
        "confidence_calibration": calibration,
        "predictions": rows,
    }


def _write_results(summary: dict[str, Any], out_dir: Path) -> tuple[Path, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    json_path = out_dir / f"classification_eval_{stamp}.json"
    json_path.write_text(
        json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    csv_path = out_dir / f"classification_eval_{stamp}.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "id",
                "language",
                "ambiguous",
                "expected_category",
                "predicted_category",
                "correct",
                "confidence",
                "skill_jaccard",
                "expected_skills",
                "predicted_skills",
            ]
        )
        for r in summary["predictions"]:
            writer.writerow(
                [
                    r["id"],
                    r["language"],
                    r["ambiguous"],
                    r["expected_category"],
                    r["predicted_category"],
                    r["correct"],
                    r["confidence"],
                    r["skill_jaccard"],
                    ";".join(r["expected_skills"]),
                    ";".join(r["predicted_skills"]),
                ]
            )
    return json_path, csv_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Classification eval harness")
    parser.add_argument(
        "--limit", type=int, default=None, help="Only run the first N items."
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=RESULTS_DIR,
        help="Directory for the timestamped JSON/CSV results.",
    )
    args = parser.parse_args()

    summary = run(limit=args.limit)
    json_path, csv_path = _write_results(summary, args.out)

    overall = summary["overall"]
    print(f"Evaluated {summary['n']} items")
    print(f"  category accuracy (micro): {overall['category_accuracy_micro']:.3f}")
    print(f"  category F1 (macro):       {overall['category_f1_macro']:.3f}")
    print(f"  mean skill Jaccard:        {overall['mean_skill_jaccard']:.3f}")
    print(f"  language accuracy:         {summary['language_accuracy']}")
    print(f"Wrote {json_path.name} and {csv_path.name} to {args.out}")


if __name__ == "__main__":
    main()
