'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { cn } from '@repo/ui';
import { useSession } from '@/lib/auth-client';
import { useNotifications } from '@/lib/hooks/use-notifications';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { NotificationRow } from './notification-row';
import type { AppNotification } from './notifications-data';

function groupByLabel(items: AppNotification[]) {
  const groups: { label: string; items: AppNotification[] }[] = [];
  for (const n of items) {
    let g = groups.find((x) => x.label === n.group);
    if (!g) {
      g = { label: n.group, items: [] };
      groups.push(g);
    }
    g.items.push(n);
  }
  return groups;
}

export function NotificationBell({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const { data: session } = useSession();
  const t = dict.notifications;
  const [open, setOpen] = useState(false);
  const { items, unread, readOne, markAll } = useNotifications(locale);

  const groups = useMemo(() => groupByLabel(items), [items]);

  if (!session) return null;

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t.title}
        aria-expanded={open}
        className={cn(
          'relative inline-flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted',
          open && 'bg-muted',
        )}
      >
        <Bell className="size-[18px]" aria-hidden />
        {unread > 0 ? (
          <span className="absolute -top-1.5 -right-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-background bg-primary px-1 font-mono text-[10px] font-bold text-primary-foreground">
            {unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <span
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40"
            aria-hidden
          />
          <div className="absolute top-[calc(100%+10px)] right-0 z-50 w-[392px] overflow-hidden rounded-xl border border-border bg-background text-left shadow-[var(--shadow-elevated)]">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5">
              <span className="text-sm font-semibold">
                {t.title}
                {unread > 0 ? (
                  <span className="font-normal text-muted-foreground">
                    {' '}
                    · {t.newCount.replace('{count}', String(unread))}
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={markAll}
                disabled={!unread}
                className={cn(
                  'text-xs font-medium',
                  unread
                    ? 'text-foreground hover:underline'
                    : 'cursor-default text-muted-foreground',
                )}
              >
                {t.markAllRead}
              </button>
            </div>
            <div className="max-h-[432px] overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {t.empty}
                </p>
              ) : null}
              {groups.map((g) => (
                <div key={g.label}>
                  <div className="bg-canvas px-4 pt-2.5 pb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    {g.label}
                  </div>
                  {g.items.map((n, i) => (
                    <div
                      key={n.id}
                      className={cn(i > 0 && 'border-t border-border')}
                    >
                      <NotificationRow
                        n={n}
                        locale={locale}
                        compact
                        onRead={readOne}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <Link
              href={`/${locale}/notifications`}
              onClick={() => setOpen(false)}
              className="block border-t border-border bg-background px-4 py-3 text-center text-sm font-medium text-foreground hover:bg-muted"
            >
              {t.seeAll}
            </Link>
          </div>
        </>
      ) : null}
    </span>
  );
}
