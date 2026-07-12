'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Input } from '@repo/ui';
import { ApiError } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import { EscrowStatusBadge, JobStatusBadge } from '@/components/status-badge';
import { Textarea } from '@/components/ui/textarea';
import {
  getEscrow,
  refundEscrow,
  resolveDispute,
  type AdminEscrowDetail,
} from '@/lib/api/escrow';

const lkr = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
  maximumFractionDigits: 0,
});

function formatDateTime(iso: string | null) {
  if (!iso) return '-';
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
  const isDisputed = e.job?.status === 'DISPUTED';

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
        <div className="flex flex-wrap items-center gap-2">
          {e.job ? <JobStatusBadge status={e.job.status} /> : null}
          <EscrowStatusBadge status={e.status} />
        </div>
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
        <Field label="Homeowner" value={e.homeowner?.name ?? '-'} />
        <Field label="Tradesman" value={e.tradesman?.name ?? '-'} />
        <Field label="Payment method" value={e.paymentMethod ?? '-'} />
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

      {isDisputed ? <DisputeMediation escrow={e} /> : null}

      <section className="space-y-3 rounded-xl border border-border p-4">
        <h3 className="text-base font-medium">Actions</h3>
        {isDisputed ? (
          <p className="text-sm text-muted-foreground">
            This job is under dispute - use <strong>Resolve dispute</strong>{' '}
            above to cancel it and settle the deposit.
          </p>
        ) : canRefund ? (
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

// Support/admin mediation for a disputed job: cancel it and refund some, all,
// or none of the deposit. The materials deposit has usually already been
// released to the tradesman, so this is a judgement call - the amount defaults
// to a full refund but can be dialled down (0 leaves the tradesman with it).
function DisputeMediation({ escrow }: { escrow: AdminEscrowDetail }) {
  const qc = useQueryClient();
  const deposit = escrow.depositAmount;
  const [amount, setAmount] = useState(String(deposit));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const parsed = Number(amount);
  const amountValid =
    amount.trim() !== '' &&
    Number.isFinite(parsed) &&
    parsed >= 0 &&
    parsed <= deposit;

  const resolve = useMutation({
    mutationFn: () =>
      resolveDispute(escrow.id, {
        refundAmount: parsed,
        resolutionNotes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.escrows() });
      void qc.invalidateQueries({ queryKey: adminKeys.escrow(escrow.id) });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to resolve dispute',
      ),
  });

  return (
    <section className="space-y-4 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
      <div className="space-y-1">
        <h3 className="text-base font-medium">Resolve dispute</h3>
        <p className="text-sm text-muted-foreground">
          Cancel this job and refund the homeowner. The deposit of{' '}
          <strong>{lkr.format(deposit)}</strong> has already been released to
          the tradesman, so choose how much to return. Refunding{' '}
          <strong>{lkr.format(0)}</strong> cancels the job without a refund.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium">
            Refund amount ({escrow.currency})
          </span>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            max={deposit}
            step="0.01"
            value={amount}
            onChange={(ev) => setAmount(ev.target.value)}
            aria-label="Refund amount"
          />
          <span className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <button
              type="button"
              className="underline hover:text-foreground"
              onClick={() => setAmount(String(deposit))}
            >
              Full ({lkr.format(deposit)})
            </button>
            <button
              type="button"
              className="underline hover:text-foreground"
              onClick={() => setAmount(String(Math.round(deposit / 2)))}
            >
              Half
            </button>
            <button
              type="button"
              className="underline hover:text-foreground"
              onClick={() => setAmount('0')}
            >
              None
            </button>
          </span>
        </label>
      </div>

      <label className="space-y-1.5">
        <span className="text-sm font-medium">Resolution notes</span>
        <Textarea
          value={notes}
          onChange={(ev) => setNotes(ev.target.value)}
          placeholder="Internal notes on the decision (saved to the related report)…"
        />
      </label>

      {!amountValid && amount.trim() !== '' ? (
        <p className="text-sm text-destructive">
          Enter an amount between {lkr.format(0)} and {lkr.format(deposit)}.
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="destructive"
          disabled={!amountValid || resolve.isPending}
          onClick={() => {
            setError(null);
            resolve.mutate();
          }}
        >
          {resolve.isPending
            ? 'Resolving…'
            : parsed > 0
              ? `Cancel job & refund ${lkr.format(parsed)}`
              : 'Cancel job (no refund)'}
        </Button>
      </div>
    </section>
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
