import { SCORING_CONFIG, clamp } from './config.js';

/**
 * Response-time sub-score in [0, 1] from a median reply time in minutes. Faster
 * than the target Tg scores near 1, slower than the poor ceiling Tp scores 0. A
 * tradesman with no measured replies gets a neutral score rather than a zero.
 *
 *   score = clamp(1 − (t − Tg) / (Tp − Tg), 0, 1)
 */
export function responseScore(
  medianMinutes: number | null | undefined,
): number {
  const { targetMinutes, poorMinutes, missingScore } = SCORING_CONFIG.response;
  if (
    medianMinutes === null ||
    medianMinutes === undefined ||
    Number.isNaN(medianMinutes)
  ) {
    return missingScore;
  }
  return clamp(
    1 - (medianMinutes - targetMinutes) / (poorMinutes - targetMinutes),
    0,
    1,
  );
}
