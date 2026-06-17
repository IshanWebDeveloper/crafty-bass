'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button, Skeleton } from '@repo/ui';
import { Card, CardContent } from '@/components/ui/card';
import { listMyJobs } from '@/lib/api/jobs';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

export function MyJobsList({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.jobs;
  const { data, isLoading } = useQuery({
    queryKey: ['jobs', 'mine'],
    queryFn: () => listMyJobs({ limit: 50 }),
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
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
          <p className="text-sm text-muted-foreground">{t.mine.empty}</p>
          <Button render={<Link href={`/${locale}/jobs/new`} />}>
            {t.mine.postOne}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="space-y-3">
      {data.data.map((job) => (
        <li key={job.id}>
          <Card>
            <CardContent className="flex items-start justify-between gap-4 p-5">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/${locale}/jobs/${job.id}`}
                  className="block text-base font-semibold hover:underline"
                >
                  {job.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {job.category?.nameEn ?? '—'} ·{' '}
                  {new Date(job.createdAt).toLocaleDateString(locale)} ·{' '}
                  {[job.city, job.district].filter(Boolean).join(', ') || '—'}
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {job.description}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2 text-right">
                <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium">
                  {t.statusLabels[job.status]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t.mine.viewQuotes.replace(
                    '{count}',
                    String(job._count.quotes),
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
