# Classification evaluation harness

Offline quality harness for the job-classification graph. It runs the **real**
classification service (the same `classify_job` entry point the `/classify-job`
route uses) over a hand-labelled dataset and reports how well it recovers the
expected service category and skills.

This is a _manual_ eval — it calls a live LLM, so it is not part of `pytest` or
CI. The pure-unit tests for the classifier live in `tests/` and run in CI.

## Layout

- `dataset/taxonomy.json` — snapshot of the seeded 16 categories + 49 skills in
  `TaxonomyOption` shape (mirrors `packages/db/prisma/seed.ts`).
- `dataset/classification_labelled.json` — 53 labelled jobs (34 EN, 11 SI, 8 TA),
  every category covered at least twice, with 4 deliberately ambiguous items
  (`"ambiguous": true`) whose label is the single most-likely category.
- `run_classification_eval.py` — the runner + pure-Python metrics.
- `results/` — timestamped JSON/CSV output (gitignored).

## Running

From `apps/ai-service`, with the venv active and an LLM key set in `.env`
(`GITHUB_TOKEN` or `OPENAI_API_KEY`, per `LLM_PROVIDER`):

```bash
python -m evals.run_classification_eval            # full dataset
python -m evals.run_classification_eval --limit 3  # quick smoke run
python -m evals.run_classification_eval --out ./results
```

### Cost

Each item is one classification call (plus up to one confidence-gated retry), so
a full run is ~53–106 LLM calls. Use `--limit` while iterating.

## Metrics

Written to `results/classification_eval_<timestamp>.{json,csv}`:

- **Category accuracy (micro)** — share of items whose predicted category equals
  the label.
- **Category F1 (macro)** — unweighted mean of per-category F1, so rare
  categories count as much as common ones.
- **Per-category precision / recall / F1 / support.**
- **Confusion matrix** — expected → predicted counts (`<none>` when the model
  abstains).
- **Confidence calibration** — accuracy vs. mean confidence per 0.1 decile
  bucket, to check whether the model's confidence is trustworthy.
- **Skill Jaccard** — mean overlap between predicted and expected skill sets.
- **Language accuracy** — accuracy broken down by EN / SI / TA.

## Citing

Reference a specific run by its timestamped filename (the JSON embeds
`generated_at`, the dataset size, and every per-item prediction), so results are
reproducible and auditable in the report.
