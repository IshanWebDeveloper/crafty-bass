'use client';

import { useMemo, useState } from 'react';
import { cn } from '@repo/ui';
import { Card, CardContent } from '@/components/ui/card';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { NotificationRow } from './notification-row';
import {
  SEED_NOTIFICATIONS,
  type AppNotification,
  type NotificationCategory,
} from './notifications-data';

type Filter = 'all' | NotificationCategory;

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

export function NotificationsView({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.notifications;
  const [items, setItems] = useState<AppNotification[]>(SEED_NOTIFICATIONS);
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(
    () =>
      filter === 'all' ? items : items.filter((n) => n.category === filter),
    [items, filter],
  );
  const groups = useMemo(() => groupByLabel(filtered), [filtered]);
  const unread = items.filter((n) => n.unread).length;

  const readOne = (id: string) =>
    setItems((xs) =>
      xs.map((n) => (n.id === id ? { ...n, unread: false } : n)),
    );
  const markAll = () =>
    setItems((xs) => xs.map((n) => ({ ...n, unread: false })));

  const tabs: { key: Filter; label: string }[] = [
    { key: 'all', label: t.filters.all },
    { key: 'escrow', label: t.filters.escrow },
    { key: 'message', label: t.filters.message },
    { key: 'job', label: t.filters.job },
    { key: 'account', label: t.filters.account },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                filter === tab.key
                  ? 'border-transparent bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:bg-muted',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={markAll}
          disabled={!unread}
          className={cn(
            'text-sm font-medium',
            unread
              ? 'text-foreground hover:underline'
              : 'cursor-default text-muted-foreground',
          )}
        >
          {t.markAllRead}
        </button>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t.empty}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="bg-canvas px-5 pt-3 pb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {g.label}
              </div>
              {g.items.map((n, i) => (
                <div
                  key={n.id}
                  className={cn(i > 0 && 'border-t border-border')}
                >
                  <NotificationRow n={n} locale={locale} onRead={readOne} />
                </div>
              ))}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
