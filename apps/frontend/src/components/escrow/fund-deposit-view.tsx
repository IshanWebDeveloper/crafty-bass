'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Lock,
  RotateCcw,
  Scale,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import { Badge, Button, Skeleton } from '@repo/ui';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  fundEscrow,
  getEscrowForJob,
  type EscrowPaymentMethod,
} from '@/lib/api/escrow';
import { formatLKR } from '@/lib/currency';
import { EscrowStrip } from './escrow-strip';
import { PaymentMethods } from './payment-methods';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

const PROCESSOR: Record<EscrowPaymentMethod, string> = {
  card: 'Stripe',
  paypal: 'PayPal',
  local: 'PayHere · LankaQR',
};

export function FundDepositView({
  jobId,
  locale,
  dict,
}: {
  jobId: string;
  locale: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const t = dict.escrow;
  const tf = t.fund;
  const [method, setMethod] = useState<EscrowPaymentMethod>('card');

  const { data: escrow, isLoading } = useQuery({
    queryKey: ['escrow', jobId],
    queryFn: () => getEscrowForJob(jobId),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: () => fundEscrow(escrow!.id, method),
    onSuccess: () => {
      toast.success(tf.success);
      void qc.invalidateQueries({ queryKey: ['escrow', jobId] });
      void qc.invalidateQueries({ queryKey: ['jobs', jobId] });
      router.push(`/${locale}/jobs/${jobId}`);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to fund'),
  });

  if (isLoading) {
    return <Skeleton className="h-96 rounded-xl" />;
  }

  if (!escrow || escrow.status !== 'REQUESTED') {
    return (
      <Card>
        <CardContent className="space-y-4 p-10 text-center">
          <p className="text-sm text-muted-foreground">{tf.notFound}</p>
          <Link
            href={`/${locale}/jobs/${jobId}`}
            className="text-sm font-medium underline-offset-4 hover:underline"
          >
            {tf.back}
          </Link>
        </CardContent>
      </Card>
    );
  }

  const deposit = escrow.depositAmount;
  const steps = [
    { label: t.steps.funded.label, note: t.steps.funded.note },
    { label: t.steps.materials.label, note: t.steps.materials.note },
    { label: t.steps.workDone.label, note: t.steps.workDone.note },
    { label: t.steps.released.label, note: t.steps.released.note },
  ];
  const protections: [typeof ShieldCheck, string][] = [
    [ShieldCheck, tf.protection1],
    [RotateCcw, tf.protection2],
    [Scale, tf.protection3],
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${locale}/jobs/${jobId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {tf.back}
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {tf.title}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          {tf.subtitle}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <div className="space-y-5">
          <Card>
            <CardContent className="flex items-center justify-between gap-3 p-5">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{tf.jobLabel}</p>
                <p className="mt-0.5 truncate text-base font-semibold">
                  {escrow.job.title}
                </p>
              </div>
              <Badge variant="success" className="shrink-0">
                {dict.quotes.accepted}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{tf.protectionHeading}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <EscrowStrip current={0} steps={steps} />
              <ul className="space-y-2.5">
                {protections.map(([Icon, text]) => (
                  <li key={text} className="flex items-start gap-2.5 text-sm">
                    <Icon
                      className="mt-0.5 size-4 shrink-0 text-success"
                      aria-hidden
                    />
                    <span className="leading-relaxed text-muted-foreground">
                      {text}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="lg:sticky lg:top-6">
          <CardContent className="space-y-5 p-5">
            <div className="space-y-2.5 text-sm">
              <Row label={t.amounts.deposit} value={formatLKR(deposit)} />
              <Row
                label={t.amounts.balance}
                value={formatLKR(escrow.balanceAmount)}
                muted
              />
              <div className="border-t border-border pt-2.5">
                <Row
                  label={t.amounts.total}
                  value={formatLKR(escrow.quoteTotal)}
                  muted
                />
              </div>
              <div className="border-t border-border pt-2.5">
                <Row label={tf.payNow} value={formatLKR(deposit)} strong />
              </div>
            </div>

            <div>
              <span className="mb-2 block text-sm font-medium">
                {tf.method}
              </span>
              <PaymentMethods value={method} onChange={setMethod} dict={dict} />
            </div>

            <Button
              size="lg"
              className="w-full"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              <Lock className="size-4" aria-hidden />
              {mutation.isPending
                ? t.actions.funding
                : tf.payCta.replace('{amount}', formatLKR(deposit))}
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-center text-[11px] leading-relaxed text-muted-foreground">
              <Shield className="size-3 shrink-0" aria-hidden />
              {tf.secured.replace('{processor}', PROCESSOR[method])}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        className={
          strong ? 'text-sm font-semibold' : 'text-sm text-muted-foreground'
        }
      >
        {label}
      </span>
      <span
        className={
          strong
            ? 'font-mono text-base font-bold'
            : muted
              ? 'font-mono text-sm text-muted-foreground'
              : 'font-mono text-sm font-semibold'
        }
      >
        {value}
      </span>
    </div>
  );
}
