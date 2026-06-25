'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, DatePicker, Input } from '@repo/ui';
import { maxDeposit } from '@repo/validation';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createQuote } from '@/lib/api/quotes';
import { getMyProfile } from '@/lib/api/profiles';
import { DepositEligibility } from '@/components/escrow/deposit-eligibility';
import { formatLKR } from '@/lib/currency';
import { ApiError } from '@/lib/api';
import { parseDateInput, formatDateInput } from '@/lib/date';
import type { Dictionary } from '@/i18n/dictionaries';

const SubmitQuoteSchema = z.object({
  amount: z
    .string()
    .min(1)
    .refine((v) => Number(v) > 0, { message: 'Amount must be positive' }),
  materials: z.string().optional(),
  currency: z.string().trim().length(3),
  message: z.string().trim().max(2000).optional(),
  estimatedStart: z.string().optional(),
  estimatedCompletion: z.string().optional(),
  wantDeposit: z.boolean(),
  deposit: z.string().optional(),
});
type SubmitQuoteValues = z.infer<typeof SubmitQuoteSchema>;

export function SubmitQuotePanel({
  jobId,
  dict,
}: {
  jobId: string;
  dict: Dictionary;
}) {
  const qc = useQueryClient();
  const t = dict.quotes;
  const ts = t.submitQuote;
  const [alreadyQuoted, setAlreadyQuoted] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<SubmitQuoteValues>({
    resolver: zodResolver(SubmitQuoteSchema),
    defaultValues: {
      amount: '',
      materials: '',
      currency: 'LKR',
      message: '',
      estimatedStart: '',
      estimatedCompletion: '',
      wantDeposit: false,
      deposit: '',
    },
  });

  const wantDeposit = watch('wantDeposit');
  const amount = Number(watch('amount')) || 0;
  const materials = Number(watch('materials')) || 0;
  const deposit = Number(watch('deposit')) || 0;

  // Only fetch the tradesman's trust profile once they opt into a deposit.
  const { data: profile } = useQuery({
    queryKey: ['profiles', 'me'],
    queryFn: getMyProfile,
    enabled: wantDeposit,
    staleTime: 60_000,
  });

  const trust = {
    verified: profile?.tradesmanProfile?.isVerified ?? false,
    rating: profile?.tradesmanProfile?.avgRating ?? 0,
    completed: profile?.tradesmanProfile?.jobsCompleted ?? 0,
    bgChecked: profile?.tradesmanProfile?.backgroundChecked ?? false,
  };
  const allowedDeposit = maxDeposit(trust, amount, materials);
  const cappedDeposit = Math.min(deposit, allowedDeposit);

  const mutation = useMutation({
    mutationFn: (values: SubmitQuoteValues) =>
      createQuote(jobId, {
        amount: Number(values.amount),
        materialsAmount: values.materials
          ? Number(values.materials)
          : undefined,
        depositRequested:
          values.wantDeposit && cappedDeposit > 0 ? cappedDeposit : undefined,
        currency: values.currency,
        message: values.message || undefined,
        estimatedStart: values.estimatedStart || undefined,
        estimatedCompletion: values.estimatedCompletion || undefined,
      }),
    onSuccess: () => {
      toast.success(ts.success);
      reset();
      void qc.invalidateQueries({ queryKey: ['jobs', jobId] });
      void qc.invalidateQueries({ queryKey: ['my-quotes'] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setAlreadyQuoted(true);
        toast.info(err.message);
        return;
      }
      toast.error(
        err instanceof Error ? err.message : 'Failed to submit quote',
      );
    },
  });

  if (alreadyQuoted) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{ts.heading}</CardTitle>
        <CardDescription>{ts.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="quote-amount">{t.amount}</Label>
              <Input
                id="quote-amount"
                type="number"
                min={0}
                step="0.01"
                aria-invalid={errors.amount !== undefined}
                {...register('amount')}
              />
              {errors.amount ? (
                <p className="text-xs text-destructive">
                  {errors.amount.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quote-materials">{ts.materials}</Label>
              <Input
                id="quote-materials"
                type="number"
                min={0}
                step="0.01"
                {...register('materials')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quote-currency">{ts.currency}</Label>
              <Input id="quote-currency" {...register('currency')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quote-message">{t.message}</Label>
            <Textarea id="quote-message" rows={3} {...register('message')} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="quote-start">{t.estimatedStart}</Label>
              <DatePicker
                id="quote-start"
                value={parseDateInput(watch('estimatedStart'))}
                onChange={(date) =>
                  setValue('estimatedStart', formatDateInput(date), {
                    shouldValidate: true,
                  })
                }
                disabledDates={{ before: new Date() }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quote-completion">{t.estimatedCompletion}</Label>
              <DatePicker
                id="quote-completion"
                value={parseDateInput(watch('estimatedCompletion'))}
                onChange={(date) =>
                  setValue('estimatedCompletion', formatDateInput(date), {
                    shouldValidate: true,
                  })
                }
                disabledDates={{ before: new Date() }}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                {...register('wantDeposit')}
              />
              <span>
                <span className="text-sm font-semibold">
                  {ts.requestDeposit}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  {ts.requestDepositHint}
                </span>
              </span>
            </label>

            {wantDeposit ? (
              <div className="space-y-3 border-t border-border pt-3">
                <DepositEligibility
                  trust={trust}
                  quoteTotal={amount}
                  materialsAmount={materials}
                  dict={dict}
                />
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="quote-deposit">{ts.depositToRequest}</Label>
                    <span className="text-xs text-muted-foreground">
                      {ts.depositMax.replace(
                        '{amount}',
                        formatLKR(allowedDeposit),
                      )}
                    </span>
                  </div>
                  <Input
                    id="quote-deposit"
                    type="number"
                    min={0}
                    step="0.01"
                    max={allowedDeposit}
                    {...register('deposit')}
                  />
                  {amount > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {ts.depositPercent
                        .replace(
                          '{pct}',
                          String(Math.round((cappedDeposit / amount) * 100)),
                        )
                        .replace(
                          '{balance}',
                          formatLKR(amount - cappedDeposit),
                        )}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? ts.submitting : ts.submit}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
