/**
 * Ranking-quality metrics used by the recommendation benchmark (TC-18).
 * The metric implementations themselves are unit-tested as TC-29; TC-18 is the
 * benchmark RUN over a labelled relevance set, which needs ground-truth data.
 *
 * Each function takes the graded relevance of the ranked items IN RANK ORDER
 * (index 0 = top result). Relevance is a non-negative grade: 0 = irrelevant,
 * higher = more relevant. These are pure functions so they are unit-testable in
 * isolation, exactly like the scoring library they sit beside.
 */

/** Fraction of the top-k items whose relevance meets `threshold`. Divides by k
 *  (the standard definition), so short lists are penalised for missing depth. */
export function precisionAtK(
  rankedRelevances: number[],
  k: number,
  threshold = 1,
): number {
  if (k <= 0) return 0;
  let hits = 0;
  for (let i = 0; i < k; i++) {
    if ((rankedRelevances[i] ?? 0) >= threshold) hits++;
  }
  return hits / k;
}

/** Reciprocal rank of the first relevant item (1/rank), or 0 if none. Averaged
 *  over queries this is MRR. */
export function reciprocalRank(
  rankedRelevances: number[],
  threshold = 1,
): number {
  for (let i = 0; i < rankedRelevances.length; i++) {
    if ((rankedRelevances[i] ?? 0) >= threshold) return 1 / (i + 1);
  }
  return 0;
}

/** Discounted cumulative gain over the top-k, with the standard exponential
 *  gain (2^rel - 1) and log2(rank + 1) discount. */
export function dcgAtK(rankedRelevances: number[], k: number): number {
  let dcg = 0;
  const depth = Math.min(k, rankedRelevances.length);
  for (let i = 0; i < depth; i++) {
    const rel = rankedRelevances[i] ?? 0;
    dcg += (Math.pow(2, rel) - 1) / Math.log2(i + 2);
  }
  return dcg;
}

/** Normalised DCG in [0, 1]: DCG of the ranking divided by DCG of the ideal
 *  (relevance-sorted) ranking. Returns 0 when there is no relevance to earn. */
export function ndcgAtK(rankedRelevances: number[], k: number): number {
  const ideal = [...rankedRelevances].sort((a, b) => b - a);
  const idcg = dcgAtK(ideal, k);
  if (idcg === 0) return 0;
  return dcgAtK(rankedRelevances, k) / idcg;
}

/** Arithmetic mean (macro-average across queries); 0 for an empty list. */
export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}
