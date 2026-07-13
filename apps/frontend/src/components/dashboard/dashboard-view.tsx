'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  Activity,
  Handshake,
  Star,
  ReceiptText,
  Clock,
  type LucideIcon,
} from 'lucide-react';
import { Badge, Skeleton, cn } from '@repo/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getDashboard } from '@/lib/api/users';
import { listMyQuotes } from '@/lib/api/quotes';
import { useMe } from '@/lib/hooks/use-me';
import { useMounted } from '@/lib/hooks/use-mounted';
import { statusVariant } from '@/lib/status';
import { CategoryBadge } from '@/lib/categories';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

/**
 * The dashboard is the landing surface after posting a job or sending a quote,
 * so its cards must reflect the very latest activity. We override the global
 * query defaults (staleTime 30s, no focus refetch) to always refetch on mount
 * and on tab focus - otherwise a freshly submitted quote/job wouldn't appear
 * when navigating back within the stale window or re-focusing the tab.
 */
const liveDashboardQuery = {
  refetchOnMount: 'always',
  refetchOnWindowFocus: true,
  staleTime: 0,
} as const;

/**
 * Role-aware dashboard. Homeowners see their posted-job activity; tradesmen see
 * their quoting activity. We render the homeowner view until the session
 * resolves on the client (and we know the userType) so SSR and the first client
 * paint agree - same approach as the role-aware nav.
 */
export function DashboardView({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const { data: me } = useMe();
  const mounted = useMounted();

  if (mounted && me?.userType === 'TRADESMAN') {
    return <TradesmanDashboard locale={locale} dict={dict} />;
  }
  return <HomeownerDashboard locale={locale} dict={dict} />;
}

function HomeownerDashboard({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.dashboard;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    ...liveDashboardQuery,
  });

  if (isLoading) return <StatsSkeleton />;
  if (isError || !data) return <EmptyState message={t.empty} />;

  return (
    <div className="space-y-6">
      {/* Homeowners post jobs - they aren't assigned work and don't receive
          reviews, so only the posted/active stats are relevant here. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label={t.stats.postedJobs}
          value={data.totalPostedJobs}
          icon={Briefcase}
          tint="text-sky-600 dark:text-sky-400"
          surface="bg-sky-500/10"
        />
        <StatCard
          label={t.stats.activeJobs}
          value={data.activePostedJobs}
          icon={Activity}
          tint="text-emerald-600 dark:text-emerald-400"
          surface="bg-emerald-500/10"
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
                  <div className="flex min-w-0 items-center gap-3">
                    <CategoryBadge
                      slug={job.category?.slug}
                      label={job.category?.nameEn ?? '-'}
                      className="hidden shrink-0 sm:inline-flex"
                    />
                    <div className="min-w-0">
                      <Link
                        href={`/${locale}/jobs/${job.id}`}
                        className="block truncate text-sm font-medium hover:underline"
                      >
                        {job.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {new Date(job.createdAt).toLocaleDateString(locale)}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={statusVariant(job.status)}
                    className="shrink-0"
                  >
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

function TradesmanDashboard({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.dashboard;
  const tt = t.tradesman;

  const dashboard = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    ...liveDashboardQuery,
  });
  const quotes = useQuery({
    queryKey: ['my-quotes'],
    queryFn: listMyQuotes,
    ...liveDashboardQuery,
  });

  if (dashboard.isLoading || quotes.isLoading) return <StatsSkeleton />;
  if (dashboard.isError || !dashboard.data)
    return <EmptyState message={t.empty} />;

  const allQuotes = quotes.data ?? [];
  const pendingQuotes = allQuotes.filter((q) => q.status === 'PENDING').length;
  const recentQuotes = allQuotes.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={tt.stats.submittedQuotes}
          value={allQuotes.length}
          icon={ReceiptText}
          tint="text-sky-600 dark:text-sky-400"
          surface="bg-sky-500/10"
        />
        <StatCard
          label={tt.stats.pendingQuotes}
          value={pendingQuotes}
          icon={Clock}
          tint="text-amber-600 dark:text-amber-400"
          surface="bg-amber-500/10"
        />
        <StatCard
          label={tt.stats.assignedJobs}
          value={dashboard.data.assignedJobs}
          icon={Handshake}
          tint="text-violet-600 dark:text-violet-400"
          surface="bg-violet-500/10"
        />
        <StatCard
          label={tt.stats.reviewsReceived}
          value={dashboard.data.reviewsReceived}
          icon={Star}
          tint="text-emerald-600 dark:text-emerald-400"
          surface="bg-emerald-500/10"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{tt.recent.heading}</CardTitle>
          <Link
            href={`/${locale}/quotes`}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {tt.recent.viewAll}
          </Link>
        </CardHeader>
        <CardContent>
          {recentQuotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tt.empty}</p>
          ) : (
            <ul className="divide-y divide-border">
              {recentQuotes.map((q) => (
                <li
                  key={q.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/${locale}/jobs/${q.job.id}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {q.job.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {q.currency} {q.amount.toLocaleString(locale)} ·{' '}
                      {new Date(q.createdAt).toLocaleDateString(locale)}
                    </p>
                  </div>
                  <Badge variant={statusVariant(q.status)} className="shrink-0">
                    {q.status}
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

function StatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="p-6 text-sm text-muted-foreground">
        {message}
      </CardContent>
    </Card>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tint,
  surface,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tint: string;
  surface: string;
}) {
  return (
    <Card className="transition-shadow hover:shadow-card">
      <CardContent className="flex items-center gap-4 p-6">
        <span
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-xl',
            surface,
          )}
        >
          <Icon className={cn('size-5', tint)} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-3xl font-semibold tracking-tight">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
