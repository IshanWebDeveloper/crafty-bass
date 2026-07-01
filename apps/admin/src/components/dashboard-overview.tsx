'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { adminKeys } from '@/lib/query-keys';
import { getMetrics, type AdminMetrics } from '@/lib/api/metrics';

function StatCard({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string;
  value: string | number;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={`mt-2 text-3xl font-semibold tabular-nums ${
          emphasis ? 'text-primary' : ''
        }`}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-4">
        <h2 className="text-base font-medium">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

const lkr = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
  maximumFractionDigits: 0,
});

export function DashboardOverview() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: adminKeys.metrics(),
    queryFn: getMetrics,
  });

  if (isError) {
    return (
      <div className="rounded-xl border border-border p-6 text-sm text-destructive">
        Failed to load metrics: {error.message}
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border p-4">
              <span className="block h-4 w-24 animate-pulse rounded bg-muted" />
              <span className="mt-3 block h-8 w-16 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl border border-border bg-muted/30" />
      </div>
    );
  }

  const m: AdminMetrics = data;
  const activeJobs = m.jobs.open + m.jobs.assigned + m.jobs.inProgress;
  const statusData = [
    { status: 'Open', count: m.jobs.open },
    { status: 'Assigned', count: m.jobs.assigned },
    { status: 'In progress', count: m.jobs.inProgress },
    { status: 'Completed', count: m.jobs.completed },
    { status: 'Cancelled', count: m.jobs.cancelled },
    { status: 'Expired', count: m.jobs.expired },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total users"
          value={m.users.total}
          hint={`${m.users.homeowners} homeowners · ${m.users.tradesmen} tradespeople`}
        />
        <StatCard
          label="Active jobs"
          value={activeJobs}
          hint={`${m.jobs.total} all-time`}
        />
        <StatCard
          label="Open reports"
          value={m.moderation.openReports}
          hint={`${m.moderation.underReviewReports} under review`}
          emphasis={m.moderation.openReports > 0}
        />
        <StatCard
          label="Pending verifications"
          value={m.moderation.pendingVerifications}
          emphasis={m.moderation.pendingVerifications > 0}
        />
        <StatCard
          label="Escrow held"
          value={lkr.format(m.escrow.activeValue)}
          hint={`${m.escrow.activeCount} active`}
        />
        <StatCard label="New signups (30d)" value={m.users.newLast30Days} />
        <StatCard label="Banned users" value={m.users.banned} />
        <StatCard label="Hidden reviews" value={m.moderation.hiddenReviews} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Activity (last 30 days)"
          description="New jobs and signups per day"
        >
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={m.series} margin={{ left: -20, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="fillJobs" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-chart-1)"
                    stopOpacity={0.6}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-chart-1)"
                    stopOpacity={0.05}
                  />
                </linearGradient>
                <linearGradient id="fillSignups" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-chart-3)"
                    stopOpacity={0.6}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-chart-3)"
                    stopOpacity={0.05}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="var(--color-border)"
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="date"
                tickFormatter={(v: string) => v.slice(5)}
                fontSize={11}
                stroke="var(--color-muted-foreground)"
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                fontSize={11}
                stroke="var(--color-muted-foreground)"
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={32}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-popover, var(--color-background))',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="jobs"
                name="Jobs"
                stroke="var(--color-chart-1)"
                fill="url(#fillJobs)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="signups"
                name="Signups"
                stroke="var(--color-chart-3)"
                fill="url(#fillSignups)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Jobs by status" description="Current distribution">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={statusData}
              margin={{ left: -20, right: 8, top: 8 }}
            >
              <CartesianGrid
                vertical={false}
                stroke="var(--color-border)"
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="status"
                fontSize={11}
                stroke="var(--color-muted-foreground)"
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={50}
              />
              <YAxis
                fontSize={11}
                stroke="var(--color-muted-foreground)"
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={32}
              />
              <Tooltip
                cursor={{ fill: 'var(--color-muted)', opacity: 0.3 }}
                contentStyle={{
                  background: 'var(--color-popover, var(--color-background))',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="count"
                name="Jobs"
                fill="var(--color-chart-2)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
