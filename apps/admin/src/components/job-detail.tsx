'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@repo/ui';
import { adminKeys } from '@/lib/query-keys';
import {
  EscrowStatusBadge,
  JobStatusBadge,
  ReportStatusBadge,
} from '@/components/status-badge';
import { getJob, type AdminJobDetail } from '@/lib/api/jobs';

const lkr = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
  maximumFractionDigits: 0,
});

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function JobDetail({ id }: { id: string }) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: adminKeys.job(id),
    queryFn: () => getJob(id),
  });

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        Failed to load job: {error.message}
      </p>
    );
  }

  if (isPending) {
    return (
      <div className="h-64 animate-pulse rounded-xl border border-border bg-muted/30" />
    );
  }

  const j: AdminJobDetail = data;
  const budget =
    j.budgetMin != null || j.budgetMax != null
      ? `${j.budgetMin != null ? lkr.format(j.budgetMin) : '—'} – ${
          j.budgetMax != null ? lkr.format(j.budgetMax) : '—'
        }`
      : 'Not specified';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{j.title}</h2>
          <p className="text-sm text-muted-foreground">
            {j.category?.nameEn ?? 'Uncategorised'} ·{' '}
            {[j.city, j.district].filter(Boolean).join(', ') || 'No location'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <JobStatusBadge status={j.status} />
          <Badge variant="outline">{j.urgency}</Badge>
        </div>
      </div>

      <section className="space-y-3 rounded-xl border border-border p-4">
        <h3 className="text-base font-medium">Details</h3>
        <p className="text-sm whitespace-pre-wrap text-muted-foreground">
          {j.description}
        </p>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Field label="Budget" value={budget} />
          <Field label="Posted" value={formatDate(j.createdAt)} />
          <Field label="Scheduled for" value={formatDate(j.scheduledFor)} />
          <Field label="Expires" value={formatDate(j.expiresAt)} />
          <Field label="Homeowner" value={j.homeowner?.name ?? '—'} />
          <Field
            label="Assigned tradesman"
            value={j.assignedTradesman?.name ?? 'Unassigned'}
          />
        </dl>
        {j.skills.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {j.skills.map((s) => (
              <Badge key={s.skill.id} variant="soft">
                {s.skill.nameEn}
              </Badge>
            ))}
          </div>
        ) : null}
      </section>

      {j.escrow ? (
        <section className="flex items-center justify-between rounded-xl border border-border p-4">
          <div>
            <h3 className="text-base font-medium">Escrow</h3>
            <p className="text-sm text-muted-foreground">
              {lkr.format(Number(j.escrow.quoteTotal))} total
            </p>
          </div>
          <div className="flex items-center gap-3">
            <EscrowStatusBadge status={j.escrow.status} />
            <Link
              href={`/escrow/${j.escrow.id}`}
              className="text-sm text-primary hover:underline"
            >
              View escrow →
            </Link>
          </div>
        </section>
      ) : null}

      <section className="space-y-3 rounded-xl border border-border p-4">
        <h3 className="text-base font-medium">
          Quotes{' '}
          <span className="text-sm font-normal text-muted-foreground">
            ({j.quotes.length})
          </span>
        </h3>
        {j.quotes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No quotes yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {j.quotes.map((q) => (
              <li
                key={q.id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span>{q.tradesman?.name ?? '—'}</span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums">
                    {lkr.format(Number(q.amount))}
                  </span>
                  <Badge variant="outline">{q.status}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {j.reports.length > 0 ? (
        <section className="space-y-3 rounded-xl border border-border p-4">
          <h3 className="text-base font-medium text-destructive">
            Reports ({j.reports.length})
          </h3>
          <ul className="divide-y divide-border">
            {j.reports.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="line-clamp-1 text-muted-foreground">
                  {r.reason}
                </span>
                <ReportStatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
