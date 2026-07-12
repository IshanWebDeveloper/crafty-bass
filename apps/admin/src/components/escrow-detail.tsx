'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button } from '@repo/ui';
import { ApiError } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import { EscrowStatusBadge } from '@/components/status-badge';
import {
  getEscrow,
  refundEscrow,
  type AdminEscrowDetail,
} from '@/lib/api/escrow';

const lkr = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
  maximumFractionDigits: 0,
});

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function EscrowDetail({ id }: { id: string }) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isPending, isError, error } = useQuery({
    queryKey: adminKeys.escrow(id),
    queryFn: () => getEscrow(id),
  });

  const refund = useMutation({
    mutationFn: () => refundEscrow(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.escrows() });
      void qc.invalidateQueries({ queryKey: adminKeys.escrow(id) });
      setConfirm(false);
    },
    onError: (err) =>
      setActionError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to refund',
      ),
  });

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        Failed to load escrow: {error.message}
      </p>
    );
  }

  if (isPending) {
    return (
      <div className="h-64 animate-pulse rounded-xl border border-border bg-muted/30" />
    );
  }

  const e: AdminEscrowDetail = data;
  const canRefund = e.status === 'FUNDED';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{e.job?.title ?? 'Escrow'}</h2>
          <Link
            href={`/jobs/${e.jobId}`}
            className="text-sm text-primary hover:underline"
          >
            View job →
          </Link>
        </div>
        <EscrowStatusBadge status={e.status} />
      </div>

      <section className="grid gap-3 rounded-xl border border-border p-4 text-sm sm:grid-cols-4">
        <Amount
          label="Quote total"
          value={e.quoteTotal}
          currency={e.currency}
        />
        <Amount
          label="Materials"
          value={e.materialsAmount}
          currency={e.currency}
        />
        <Amount label="Deposit" value={e.depositAmount} currency={e.currency} />
        <Amount label="Balance" value={e.balanceAmount} currency={e.currency} />
      </section>

      <section className="grid gap-3 rounded-xl border border-border p-4 text-sm sm:grid-cols-2">
        <Field label="Homeowner" value={e.homeowner?.name ?? '—'} />
        <Field label="Tradesman" value={e.tradesman?.name ?? '—'} />
        <Field label="Payment method" value={e.paymentMethod ?? '—'} />
        <Field label="Funded" value={formatDateTime(e.fundedAt)} />
        <Field
          label="Materials released"
          value={formatDateTime(e.materialsReleasedAt)}
        />
        <Field
          label="Work completed"
          value={formatDateTime(e.workCompletedAt)}
        />
        <Field label="Released" value={formatDateTime(e.releasedAt)} />
        <Field label="Refunded" value={formatDateTime(e.refundedAt)} />
      </section>

      <section className="space-y-3 rounded-xl border border-border p-4">
        <h3 className="text-base font-medium">Ledger</h3>
        {e.transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No transactions recorded yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {e.transactions.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <Badge variant="outline">{t.type}</Badge>
                  {t.note ? (
                    <span className="text-muted-foreground">{t.note}</span>
                  ) : null}
                </span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums">{lkr.format(t.amount)}</span>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateTime(t.createdAt)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-border p-4">
        <h3 className="text-base font-medium">Actions</h3>
        {canRefund ? (
          confirm ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Refund the {lkr.format(e.depositAmount)} deposit to the
                homeowner?
              </span>
              <Button
                variant="destructive"
                disabled={refund.isPending}
                onClick={() => refund.mutate()}
              >
                {refund.isPending ? 'Refunding…' : 'Confirm refund'}
              </Button>
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setConfirm(true)}>
              Refund deposit
            </Button>
          )
        ) : (
          <p className="text-sm text-muted-foreground">
            A deposit can only be refunded while it is <strong>Funded</strong>{' '}
            and work has not started.
          </p>
        )}
        {actionError ? (
          <p className="text-sm text-destructive">{actionError}</p>
        ) : null}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function Amount({
  label,
  value,
  currency,
}: {
  label: string;
  value: number;
  currency: string;
}) {
  const fmt = new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  });
  return (
    <div className="space-y-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="text-lg font-semibold tabular-nums">{fmt.format(value)}</p>
    </div>
  );
}
