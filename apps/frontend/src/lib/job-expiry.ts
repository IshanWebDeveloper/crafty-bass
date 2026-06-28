// Open jobs lapse based on urgency (see backend JobsService). The board flags
// ones nearing their `expiresAt` so tradesmen can prioritise before they go.

const SOON_MS = 48 * 60 * 60 * 1000; // within 2 days

export type JobExpiryState = {
  expired: boolean;
  expiringSoon: boolean;
  hoursLeft: number | null;
};

/**
 * Derives expiry state for a job from its `expiresAt`. Only meaningful while the
 * job is still OPEN; other statuses return a neutral state.
 */
export function jobExpiry(
  expiresAt: string | null | undefined,
  status: string,
): JobExpiryState {
  if (!expiresAt || status !== 'OPEN') {
    return { expired: false, expiringSoon: false, hoursLeft: null };
  }
  const msLeft = new Date(expiresAt).getTime() - Date.now();
  return {
    expired: msLeft <= 0,
    expiringSoon: msLeft > 0 && msLeft <= SOON_MS,
    hoursLeft: Math.max(0, Math.ceil(msLeft / (60 * 60 * 1000))),
  };
}
