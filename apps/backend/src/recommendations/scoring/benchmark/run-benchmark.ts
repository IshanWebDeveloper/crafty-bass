/**
 * CLI runner for the recommendation ranking benchmark (TC-18).
 *
 *   # simulated latent-truth study (the reported TC-18 result)
 *   pnpm --filter backend exec tsx \
 *     src/recommendations/scoring/benchmark/run-benchmark.ts --simulated
 *
 *   # a DB-derived or hand-graded dataset (see README)
 *   pnpm --filter backend exec tsx \
 *     src/recommendations/scoring/benchmark/run-benchmark.ts [dataset.json]
 *
 * Options for --simulated: --jobs N (default 300), --seeds N (default 5).
 * Simulated output goes to ./results/ (report JSON + a markdown summary);
 * dataset output goes to ./benchmark-report.json as before.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { SCORING_CONFIG, type ScoreWeights } from '../index.js';
import { mean } from '../metrics.js';
import {
  runBenchmark,
  type BenchmarkDataset,
  type BenchmarkReport,
} from './benchmark.js';
import {
  PREFERENCE_PROFILES,
  SIMULATION_ASSUMPTIONS,
  simulateDataset,
} from './simulate.js';
import { meanNdcg, runRobustness } from './sweep.js';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string, dflt: number) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : dflt;
};
const pct = (x: number) => (x * 100).toFixed(1).padStart(6) + '%';
const f3 = (x: number) => x.toFixed(3);
const fw = (w: ScoreWeights) =>
  `${w.reputation.toFixed(2)} / ${w.proximity.toFixed(2)} / ${w.completion.toFixed(2)} / ${w.response.toFixed(2)}`;

function printReport(title: string, r: BenchmarkReport) {
  console.log(
    `\n${title}  (jobs=${r.jobCount}, candidates=${r.candidateCount}, k=${r.k}, relevance>=${r.relevanceThreshold})`,
  );
  console.log(
    ['strategy'.padEnd(20), 'precision@k', '    MRR', ' nDCG@k'].join('  '),
  );
  for (const s of r.results) {
    console.log(
      [
        s.strategy.padEnd(20),
        '    ' + pct(s.precisionAtK),
        pct(s.mrr),
        pct(s.ndcgAtK),
      ].join('  '),
    );
  }
  for (const c of r.comparisons) {
    console.log(
      `  composite vs ${c.baseline.padEnd(20)} ΔnDCG ${f3(c.ndcgDelta)}  95% CI [${f3(c.ci95[0])}, ${f3(c.ci95[1])}]  wins ${pct(c.winRate)}`,
    );
  }
}

function runDataset() {
  const datasetPath = resolve(
    here,
    args.find((a) => !a.startsWith('--')) ?? 'dataset.json',
  );
  let dataset: BenchmarkDataset;
  try {
    dataset = JSON.parse(readFileSync(datasetPath, 'utf8')) as BenchmarkDataset;
  } catch {
    console.error(
      `No dataset at ${datasetPath}. Build one with build-dataset.ts, or run --simulated.`,
    );
    process.exit(1);
  }
  const report = runBenchmark(dataset);
  printReport('Recommendation ranking benchmark', report);
  if (report.jobCount < 30) {
    console.warn(
      `\nWARNING: only ${report.jobCount} jobs. Too few to support any conclusion; ` +
        `report the --simulated study instead.`,
    );
  }
  const outPath = resolve(here, 'benchmark-report.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${outPath}\n`);
}

function runSimulated() {
  const jobs = opt('--jobs', 300);
  const seeds = opt('--seeds', 5);
  const MAIN_SEED = 2026;
  const TUNE_SEED = 1;
  const TEST_SEED = 2;

  // 1. Main study: every profile on the same simulated market.
  const main = PREFERENCE_PROFILES.map((profile) => {
    const report = runBenchmark(
      simulateDataset({ seed: MAIN_SEED, jobs, profile }),
    );
    printReport(`[${profile.name}]`, report);
    return { profile, report };
  });

  // 2. Replication over independent markets (population + jobs re-drawn).
  const replication = PREFERENCE_PROFILES.map((profile) => {
    const byStrategy: Record<string, number[]> = {};
    for (let s = 0; s < seeds; s++) {
      const r = runBenchmark(
        simulateDataset({ seed: MAIN_SEED + 100 + s, jobs, profile }),
        {
          randomRepeats: 50,
          bootstrapSamples: 200,
        },
      );
      for (const x of r.results)
        (byStrategy[x.strategy] ??= []).push(x.ndcgAtK);
    }
    const sd = (xs: number[]) => {
      const m = mean(xs);
      return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
    };
    return {
      profile: profile.name,
      ndcg: Object.fromEntries(
        Object.entries(byStrategy).map(([k, v]) => [
          k,
          { mean: mean(v), sd: sd(v), runs: v },
        ]),
      ),
    };
  });

  // 3. Weight robustness: select on a tuning market, confirm on a held-out one.
  console.log('\nRunning weight sweep (969 vectors x 5 profiles)...');
  const tuneSets = PREFERENCE_PROFILES.map((p) => ({
    profile: p.name,
    dataset: simulateDataset({ seed: TUNE_SEED, jobs, profile: p }),
  }));
  const testSets = PREFERENCE_PROFILES.map((p) => ({
    profile: p.name,
    dataset: simulateDataset({ seed: TEST_SEED, jobs, profile: p }),
  }));
  const robustness = runRobustness(tuneSets);
  const heldOut = (w: ScoreWeights) =>
    mean(testSets.map((t) => meanNdcg(t.dataset, w)));
  const heldOutNdcg = {
    production: heldOut(SCORING_CONFIG.weights),
    bestByMean: heldOut(robustness.bestByMean.weights),
    minimaxRegret: heldOut(robustness.minimaxRegret.weights),
  };

  const out = {
    generatedAt: new Date().toISOString(),
    method:
      'latent-truth simulation (see simulate.ts); NOT real user behaviour',
    seeds: {
      main: MAIN_SEED,
      replication: `${MAIN_SEED + 100}..${MAIN_SEED + 99 + seeds}`,
      tune: TUNE_SEED,
      test: TEST_SEED,
    },
    jobsPerProfile: jobs,
    productionWeights: SCORING_CONFIG.weights,
    profiles: PREFERENCE_PROFILES,
    assumptions: SIMULATION_ASSUMPTIONS,
    main: main.map(({ profile, report }) => ({
      profile: profile.name,
      ...report,
    })),
    replication,
    robustness: { ...robustness, heldOutNdcg },
  };

  const dir = resolve(here, 'results');
  mkdirSync(dir, { recursive: true });
  const jsonPath = resolve(dir, 'simulated-report.json');
  writeFileSync(jsonPath, JSON.stringify(out, null, 2));
  const mdPath = resolve(dir, 'simulated-summary.md');
  writeFileSync(
    mdPath,
    summaryMarkdown(out, main, replication, robustness, heldOutNdcg),
  );
  console.log(`\nWrote ${jsonPath}\nWrote ${mdPath}\n`);
}

function summaryMarkdown(
  out: { generatedAt: string; jobsPerProfile: number },
  main: Array<{ profile: { name: string }; report: BenchmarkReport }>,
  replication: Array<{
    profile: string;
    ndcg: Record<string, { mean: number; sd: number; runs: number[] }>;
  }>,
  robustness: ReturnType<typeof runRobustness>,
  heldOut: { production: number; bestByMean: number; minimaxRegret: number },
): string {
  const L: string[] = [];
  const seedsLabel = String(
    Object.values(replication[0].ndcg)[0]?.runs.length ?? 0,
  );
  const balanced = main.find((m) => m.profile.name === 'balanced')!.report;
  L.push('# TC-18 recommendation benchmark: simulated latent-truth study');
  L.push('');
  L.push(
    `Generated ${out.generatedAt}. ${out.jobsPerProfile} jobs per preference profile, about 20 candidates per job, k = ${balanced.k}.`,
  );
  L.push(
    'Ground truth comes from latent tradesman attributes the ranker never sees; the ranker sees only noisy, sparse observations. These are simulation results, not measurements of real users.',
  );
  L.push('');
  L.push('## Ranking quality, balanced profile');
  L.push('');
  L.push('| Strategy | Precision@5 | MRR | nDCG@5 |');
  L.push('|---|---|---|---|');
  for (const s of balanced.results)
    L.push(
      `| ${s.strategy} | ${f3(s.precisionAtK)} | ${f3(s.mrr)} | ${f3(s.ndcgAtK)} |`,
    );
  L.push('');
  L.push(
    '## Composite vs each baseline, all profiles (paired bootstrap, 2000 resamples)',
  );
  L.push('');
  L.push('| Profile | Baseline | ΔnDCG@5 | 95% CI | Composite wins |');
  L.push('|---|---|---|---|---|');
  for (const { profile, report } of main) {
    for (const c of report.comparisons) {
      L.push(
        `| ${profile.name} | ${c.baseline} | ${f3(c.ndcgDelta)} | [${f3(c.ci95[0])}, ${f3(c.ci95[1])}] | ${(c.winRate * 100).toFixed(0)}% |`,
      );
    }
  }
  L.push('');
  L.push(
    `## Replication across ${seedsLabel} independent simulated markets (nDCG@5 mean ± sd)`,
  );
  L.push('');
  const strategies = Object.keys(replication[0].ndcg);
  L.push(`| Profile | ${strategies.join(' | ')} |`);
  L.push(`|---|${strategies.map(() => '---').join('|')}|`);
  for (const r of replication) {
    L.push(
      `| ${r.profile} | ${strategies.map((s) => `${f3(r.ndcg[s].mean)} ± ${f3(r.ndcg[s].sd)}`).join(' | ')} |`,
    );
  }
  L.push('');
  L.push(
    `## Cold-start exposure, balanced profile (cold-start = at most ${balanced.coldStart.maxReviews} reviews)`,
  );
  L.push('');
  L.push(
    `Cold-start tradesmen are ${(balanced.coldStart.poolShare * 100).toFixed(1)}% of candidates and ${(balanced.coldStart.strongShare * 100).toFixed(1)}% of genuinely strong (grade >= 2) candidates.`,
  );
  L.push('');
  L.push('| Strategy | Share of top-5 slots | Strong cold-start recall@5 |');
  L.push('|---|---|---|');
  for (const s of balanced.coldStart.byStrategy)
    L.push(
      `| ${s.strategy} | ${(s.topKShare * 100).toFixed(1)}% | ${(s.strongRecall * 100).toFixed(1)}% |`,
    );
  L.push('');
  L.push(
    `## Weight robustness (${robustness.gridSize} weight vectors, 0.05 grid; selected on seed 1, confirmed on held-out seed 2)`,
  );
  L.push('');
  L.push('Weights are reputation / proximity / completion / response.');
  L.push('');
  L.push(
    '| Weights | Role | Mean nDCG@5 (tune) | Worst-case regret (tune) | Mean nDCG@5 (held-out) |',
  );
  L.push('|---|---|---|---|---|');
  L.push(
    `| ${fw(SCORING_CONFIG.weights)} | production (rank ${robustness.production.meanRank} by mean, ${robustness.production.regretRank} by regret) | ${f3(robustness.production.meanNdcg)} | ${f3(robustness.production.maxRegret)} | ${f3(heldOut.production)} |`,
  );
  L.push(
    `| ${fw(robustness.bestByMean.weights)} | best mean | ${f3(robustness.bestByMean.meanNdcg)} | ${f3(robustness.bestByMean.maxRegret)} | ${f3(heldOut.bestByMean)} |`,
  );
  L.push(
    `| ${fw(robustness.minimaxRegret.weights)} | minimax regret | ${f3(robustness.minimaxRegret.meanNdcg)} | ${f3(robustness.minimaxRegret.maxRegret)} | ${f3(heldOut.minimaxRegret)} |`,
  );
  L.push('');
  return L.join('\n');
}

if (flag('--simulated')) runSimulated();
else runDataset();
