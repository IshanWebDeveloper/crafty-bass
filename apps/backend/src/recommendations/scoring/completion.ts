import { SCORING_CONFIG, clamp } from './config.js';

/** Job outcomes within the scoring window (see SCORING_CONFIG.completion). */
export interface CompletionInput {
  completed: number;
  cancelled: number;
}

/**
 * Completion sub-score in [0, 1]: a Bayesian-smoothed completion rate over the
 * rolling window, so a flaky-now tradesman can't hide behind an old record and
 * a newcomer isn't punished for having no history.
 *
 *   n = completed + cancelled
 *   score = (C·p + completed) / (C + n)
 */
export function completionScore({
  completed,
  cancelled,
}: CompletionInput): number {
  const { priorRate, priorCount } = SCORING_CONFIG.completion;
  const c = Math.max(0, completed);
  const n = c + Math.max(0, cancelled);
  return clamp((priorCount * priorRate + c) / (priorCount + n), 0, 1);
}
