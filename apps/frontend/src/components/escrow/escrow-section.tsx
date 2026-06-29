'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, buttonVariants } from '@repo/ui';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ApiError } from '@/lib/api';
import {
  approveEscrow,
  escrowStripStep,
  getEscrowForJob,
  markWorkDone,
  refundEscrow,
  releaseMaterials,
  type Escrow,
} from '@/lib/api/escrow';
import { formatLKR } from '@/lib/currency';
import { EscrowStrip } from './escrow-strip';
import { GuaranteeBadge } from '@/components/brand/guarantee-badge';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

export function EscrowSection({
  jobId,
  userId,
  locale,
  dict,
}: {
  jobId: string;
  userId: string;
  locale: Locale;
  dict: Dictionary;
}) {
  const qc = useQueryClient();
  const t = dict.escrow;

  const { data: escrow, isLoading } = useQuery({
    queryKey: ['escrow', jobId],
    queryFn: () => getEscrowForJob(jobId),
    // No escrow exists for jobs without a materials deposit — a 404 is expected.
    retry: (count, err) =>
      !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['escrow', jobId] });
    void qc.invalidateQueries({ queryKey: ['jobs', jobId] });
  };

  const onError = (err: unknown) =>
    toast.error(err instanceof Error ? err.message : 'Something went wrong');

  const startMutation = useMutation({
    mutationFn: () => releaseMaterials(escrow!.id),
    onSuccess: () => {
      toast.success(t.startedToast);
      invalidate();
    },
    onError,
  });
  const doneMutation = useMutation({
    mutationFn: () => markWorkDone(escrow!.id),
    onSuccess: () => {
      toast.success(t.doneToast);
      invalidate();
    },
    onError,
  });
  const approveMutation = useMutation({
    mutationFn: () => approveEscrow(escrow!.id),
    onSuccess: () => {
      toast.success(t.approvedToast);
      invalidate();
    },
    onError,
  });
  const refundMutation = useMutation({
    mutationFn: () => refundEscrow(escrow!.id),
    onSuccess: () => {
      toast.success(t.refundedToast);
      invalidate();
    },
    onError,
  });

  if (isLoading || !escrow) return null;

  const isHomeowner = userId === escrow.homeowner.id;
  const isTradesman = userId === escrow.tradesman.id;
  const step = escrowStripStep(escrow.status);
  const steps = [
    { label: t.steps.funded.label, note: t.steps.funded.note },
    { label: t.steps.materials.label, note: t.steps.materials.note },
    { label: t.steps.workDone.label, note: t.steps.workDone.note },
    { label: t.steps.released.label, note: t.steps.released.note },
  ];

  const summary = summaryFor(escrow, t);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{t.heading}</CardTitle>
            <CardDescription>{t.subtitle}</CardDescription>
          </div>
          <Badge variant={statusVariant(escrow)} className="shrink-0">
            {t.status[escrow.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {escrow.status !== 'REFUNDED' && escrow.status !== 'CANCELLED' ? (
          <EscrowStrip current={step} steps={steps} />
        ) : null}

        <div className="grid gap-2 border-t border-border pt-4 text-sm">
          <Row
            label={t.amounts.deposit}
            value={formatLKR(escrow.depositAmount)}
          />
          <Row
            label={t.amounts.balance}
            value={formatLKR(escrow.balanceAmount)}
          />
          <Row
            label={t.amounts.total}
            value={formatLKR(escrow.quoteTotal)}
            muted
          />
        </div>

        {summary ? (
          <p className="text-xs text-muted-foreground">
            <span className="font-mono font-semibold text-foreground">
              {summary.amount}
            </span>{' '}
            {summary.label}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {isHomeowner && escrow.status === 'REQUESTED' ? (
            <Link
              href={`/${locale}/jobs/${jobId}/fund`}
              className={buttonVariants({ size: 'sm' })}
            >
              {t.actions.fund}
            </Link>
          ) : null}

          {isTradesman && escrow.status === 'FUNDED' ? (
            <Button
              size="sm"
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
            >
              {startMutation.isPending
                ? t.actions.starting
                : t.actions.startWork}
            </Button>
          ) : null}

          {isHomeowner && escrow.status === 'FUNDED' ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (window.confirm(t.actions.refundConfirm))
                  refundMutation.mutate();
              }}
              disabled={refundMutation.isPending}
            >
              {refundMutation.isPending
                ? t.actions.refunding
                : t.actions.refund}
            </Button>
          ) : null}

          {isTradesman && escrow.status === 'MATERIALS_RELEASED' ? (
            <Button
              size="sm"
              onClick={() => doneMutation.mutate()}
              disabled={doneMutation.isPending}
            >
              {doneMutation.isPending ? t.actions.marking : t.actions.markDone}
            </Button>
          ) : null}

          {isHomeowner && escrow.status === 'WORK_COMPLETED' ? (
            <Button
              size="sm"
              onClick={() => {
                if (window.confirm(t.actions.approveConfirm))
                  approveMutation.mutate();
              }}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending
                ? t.actions.approving
                : t.actions.approve}
            </Button>
          ) : null}
        </div>

        <div className="flex items-center gap-2 border-t border-border pt-4">
          <GuaranteeBadge locale={locale} dict={dict} />
        </div>
      </CardContent>
    </Card>
  );
}

function summaryFor(escrow: Escrow, t: Dictionary['escrow']) {
  switch (escrow.status) {
    case 'REQUESTED':
    case 'FUNDED':
      return {
        amount: formatLKR(escrow.depositAmount),
        label: t.amounts.inEscrow,
      };
    case 'WORK_COMPLETED':
      return {
        amount: formatLKR(escrow.balanceAmount),
        label: t.amounts.balancePending,
      };
    default:
      return null;
  }
}

function statusVariant(escrow: Escrow): 'soft' | 'success' | 'muted' {
  if (escrow.status === 'RELEASED') return 'success';
  if (escrow.status === 'REFUNDED' || escrow.status === 'CANCELLED')
    return 'muted';
  return 'soft';
}

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          muted
            ? 'font-mono text-muted-foreground'
            : 'font-mono font-semibold text-foreground'
        }
      >
        {value}
      </span>
    </div>
  );
}
