'use client';

import type { UseQueryResult } from '@tanstack/react-query';
import {
  useOpenReportsCount,
  usePendingVerificationsCount,
  useActiveJobsCount,
} from '@/lib/hooks/use-admin-stats';

function StatCard({
  label,
  query,
}: {
  label: string;
  query: UseQueryResult<number>;
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">
        {query.isPending ? (
          <span
            className="inline-block h-8 w-12 animate-pulse rounded bg-muted align-middle"
            aria-hidden
          />
        ) : query.isError ? (
          <span className="text-destructive" title={query.error.message}>
            —
          </span>
        ) : (
          query.data
        )}
      </p>
    </div>
  );
}

export function DashboardStats() {
  const openReports = useOpenReportsCount();
  const pendingVerifications = usePendingVerificationsCount();
  const activeJobs = useActiveJobsCount();

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <StatCard label="Open reports" query={openReports} />
      <StatCard label="Pending verifications" query={pendingVerifications} />
      <StatCard label="Active jobs" query={activeJobs} />
    </div>
  );
}
