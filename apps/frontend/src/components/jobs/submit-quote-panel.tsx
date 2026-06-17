'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Input } from '@repo/ui';
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
import { ApiError } from '@/lib/api';
import type { Dictionary } from '@/i18n/dictionaries';

const SubmitQuoteSchema = z.object({
  amount: z
    .string()
    .min(1)
    .refine((v) => Number(v) > 0, { message: 'Amount must be positive' }),
  currency: z.string().trim().length(3),
  message: z.string().trim().max(2000).optional(),
  estimatedStart: z.string().optional(),
  estimatedCompletion: z.string().optional(),
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
  const [alreadyQuoted, setAlreadyQuoted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<SubmitQuoteValues>({
    resolver: zodResolver(SubmitQuoteSchema),
    defaultValues: {
      amount: '',
      currency: 'LKR',
      message: '',
      estimatedStart: '',
      estimatedCompletion: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: SubmitQuoteValues) =>
      createQuote(jobId, {
        amount: Number(values.amount),
        currency: values.currency,
        message: values.message || undefined,
        estimatedStart: values.estimatedStart || undefined,
        estimatedCompletion: values.estimatedCompletion || undefined,
      }),
    onSuccess: () => {
      toast.success(t.submitQuote.success);
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
        <CardTitle className="text-lg">{t.submitQuote.heading}</CardTitle>
        <CardDescription>{t.submitQuote.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
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
              <Label htmlFor="quote-currency">Currency</Label>
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
              <Input
                id="quote-start"
                type="date"
                {...register('estimatedStart')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quote-completion">{t.estimatedCompletion}</Label>
              <Input
                id="quote-completion"
                type="date"
                {...register('estimatedCompletion')}
              />
            </div>
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending}
          >
            {mutation.isPending
              ? t.submitQuote.submitting
              : t.submitQuote.submit}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
