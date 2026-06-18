'use client';

import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@repo/ui';
import { Card, CardContent } from '@/components/ui/card';
import { listMyReports } from '@/lib/api/reports';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

export function MyReportsList({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.reports;
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'mine'],
    queryFn: listMyReports,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          {t.history.empty}
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="space-y-3">
      {data.data.map((r) => (
        <li key={r.id}>
          <Card>
            <CardContent className="flex items-start justify-between gap-4 p-5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {t.targetTypes[r.targetType]}
                </p>
                <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                  {r.reason}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t.history.filed}{' '}
                  {new Date(r.createdAt).toLocaleDateString(locale)}
                </p>
              </div>
              <span className="rounded-full border border-border px-2.5 py-0.5 text-xs">
                {t.statusLabels[r.status]}
              </span>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
