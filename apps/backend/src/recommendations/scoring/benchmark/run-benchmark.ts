/**
 * CLI runner for the recommendation ranking benchmark (TC-18).
 *
 *   pnpm --filter backend exec tsx \
 *     src/recommendations/scoring/benchmark/run-benchmark.ts [dataset.json]
 *
 * Loads the labelled dataset, runs the benchmark, prints a table and writes
 * benchmark-report.json next to the dataset. Defaults to ./dataset.json in this
 * folder (which you create from dataset.template.json).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { runBenchmark, type BenchmarkDataset } from './benchmark.js';

const here = dirname(fileURLToPath(import.meta.url));
const datasetPath = resolve(here, process.argv[2] ?? 'dataset.json');

let dataset: BenchmarkDataset;
try {
  dataset = JSON.parse(readFileSync(datasetPath, 'utf8')) as BenchmarkDataset;
} catch {
  console.error(
    `No dataset at ${datasetPath}. Copy dataset.template.json to dataset.json ` +
      `and fill it with real ground-truth relevance grades first.`,
  );
  process.exit(1);
}

const report = runBenchmark(dataset);
const pct = (x: number) => (x * 100).toFixed(1).padStart(6) + '%';

console.log(
  `\nRecommendation ranking benchmark  (jobs=${report.jobCount}, ` +
    `candidates=${report.candidateCount}, k=${report.k}, ` +
    `relevance>=${report.relevanceThreshold})\n`,
);
console.log(['strategy'.padEnd(16), 'precision@k', 'MRR', 'nDCG@k'].join('  '));
for (const r of report.results) {
  console.log(
    [
      r.strategy.padEnd(16),
      pct(r.precisionAtK),
      pct(r.mrr),
      pct(r.ndcgAtK),
    ].join('  '),
  );
}

const outPath = resolve(here, 'benchmark-report.json');
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`\nWrote ${outPath}\n`);
