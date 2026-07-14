// Display model for the notification bell + centre. The backend
// (`/api/v1/notifications`) returns the raw records; this maps each one to the
// presentational shape the rows render. Dynamic copy (title/body) is English
// from the backend; the surrounding chrome is localised via the `notifications`
// dictionary block, and the date-derived `group`/`time` use the active locale.

import type {
  ApiNotification,
  NotificationType,
} from '@/lib/api/notifications';

export type NotificationTint = 'green' | 'amber' | 'neutral';
export type NotificationCategory = 'escrow' | 'message' | 'job' | 'account';

export type AppNotification = {
  id: string;
  category: NotificationCategory;
  group: string;
  tint: NotificationTint;
  icon: string;
  unread: boolean;
  time: string;
  title: string;
  body?: string;
  href?: string;
  action?: string;
};

// Per-type presentation. Extend this as new NotificationType values land.
const NOTIFICATION_META: Record<
  NotificationType,
  { category: NotificationCategory; tint: NotificationTint; icon: string }
> = {
  JOB_EXPIRING: { category: 'job', tint: 'amber', icon: 'clock' },
  QUOTE_RECEIVED: { category: 'job', tint: 'green', icon: 'receipt-text' },
  QUOTE_ACCEPTED: { category: 'job', tint: 'green', icon: 'badge-check' },
  QUOTE_DECLINED: { category: 'job', tint: 'neutral', icon: 'circle-x' },
  ESCROW_FUNDED: { category: 'escrow', tint: 'green', icon: 'hand-coins' },
  WORK_STARTED: { category: 'job', tint: 'green', icon: 'wrench' },
  WORK_COMPLETED: { category: 'job', tint: 'amber', icon: 'circle-check-big' },
  JOB_COMPLETED: { category: 'escrow', tint: 'green', icon: 'hand-coins' },
  JOB_CANCELLED: { category: 'job', tint: 'neutral', icon: 'circle-x' },
  JOB_EXPIRED: { category: 'job', tint: 'amber', icon: 'clock' },
  MATERIAL_REQUEST_DECLINED: {
    category: 'job',
    tint: 'neutral',
    icon: 'circle-x',
  },
  REVIEW_MODERATED: { category: 'account', tint: 'neutral', icon: 'circle-x' },
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

// Coarse bucket used as a section header. Matches the original three groups.
function groupFor(date: Date, now: Date): string {
  const today = startOfDay(now);
  if (date >= today) return 'Today';
  if (date >= new Date(today.getTime() - 6 * DAY_MS)) return 'This week';
  return 'Earlier';
}

// Compact, human-friendly timestamp (e.g. "20m ago", "Yesterday", "18 Jun").
function relativeTime(date: Date, now: Date, locale: string): string {
  const diff = now.getTime() - date.getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;

  const today = startOfDay(now);
  if (date >= today) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (date >= new Date(today.getTime() - DAY_MS)) return 'Yesterday';
  if (date >= new Date(today.getTime() - 6 * DAY_MS)) {
    return date.toLocaleDateString(locale, { weekday: 'short' });
  }
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

/** Maps a backend notification record to its presentational form. */
export function toAppNotification(
  n: ApiNotification,
  locale: string,
  now: Date = new Date(),
): AppNotification {
  const meta = NOTIFICATION_META[n.type] ?? {
    category: 'account' as const,
    tint: 'neutral' as const,
    icon: 'bell',
  };
  const date = new Date(n.createdAt);
  return {
    id: n.id,
    category: meta.category,
    group: groupFor(date, now),
    tint: meta.tint,
    icon: meta.icon,
    unread: !n.read,
    time: relativeTime(date, now, locale),
    title: n.title,
    body: n.body ?? undefined,
    href: n.href ?? undefined,
  };
}
