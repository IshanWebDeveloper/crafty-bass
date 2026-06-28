import { Clock } from 'lucide-react';
import { jobExpiry } from '@/lib/job-expiry';
import type { Dictionary } from '@/i18n/dictionaries';

/**
 * A red pill warning that an OPEN job is about to expire (or has lapsed). Shown
 * on the job board and detail to help tradesmen prioritise. Renders nothing when
 * the job isn't near expiry.
 */
export function JobExpiryBadge({
  job,
  dict,
}: {
  job: { expiresAt: string | null; status: string };
  dict: Dictionary;
}) {
  const { expired, expiringSoon, hoursLeft } = jobExpiry(
    job.expiresAt,
    job.status,
  );
  if (!expired && !expiringSoon) return null;

  const t = dict.jobs.browse;
  const label = expired
    ? t.expired
    : t.expiringIn.replace('{h}', String(hoursLeft ?? 0));

  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
      <Clock className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}
