'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, Skeleton } from '@repo/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getDashboard } from '@/lib/api/users';
import { statusVariant } from '@/lib/status';
import { useSession } from '@/lib/auth-client';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

export function DashboardView({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();
  const t = dict.dashboard;

  useEffect(() => {
    if (!sessionPending && !session) {
      router.replace(`/${locale}/sign-in`);
    }
  }, [session, sessionPending, router, locale]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    enabled: !!session,
  });

  if (sessionPending || !session || isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          {t.empty}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t.stats.postedJobs} value={data.totalPostedJobs} />
        <StatCard label={t.stats.activeJobs} value={data.activePostedJobs} />
        <StatCard label={t.stats.assignedJobs} value={data.assignedJobs} />
        <StatCard
          label={t.stats.reviewsReceived}
          value={data.reviewsReceived}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{t.recent.heading}</CardTitle>
          <Link
            href={`/${locale}/jobs/mine`}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t.recent.viewAll}
          </Link>
        </CardHeader>
        <CardContent>
          {data.recentPostedJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.empty}</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.recentPostedJobs.map((job) => (
                <li
                  key={job.id}
                  className="flex items-center justify-between py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/${locale}/jobs/${job.id}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {job.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {job.category?.nameEn ?? '—'} ·{' '}
                      {new Date(job.createdAt).toLocaleDateString(locale)}
                    </p>
                  </div>
                  <Badge variant={statusVariant(job.status)}>
                    {job.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}
