'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ReceiptText } from 'lucide-react';
import { Badge, Button, Skeleton } from '@repo/ui';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { listMyQuotes, withdrawQuote } from '@/lib/api/quotes';
import { QuoteMaterials } from '@/components/quotes/quote-materials';
import { statusVariant } from '@/lib/status';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

export function MyQuotesList({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const qc = useQueryClient();
  const t = dict.quotes;
  const tm = dict.myQuotes;
  const tj = dict.jobs;

  const { data, isLoading } = useQuery({
    queryKey: ['my-quotes'],
    queryFn: listMyQuotes,
  });

  const withdraw = useMutation({
    mutationFn: (id: string) => withdrawQuote(id),
    onSuccess: () => {
      toast.success(tm.withdrawSuccess);
      void qc.invalidateQueries({ queryKey: ['my-quotes'] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to withdraw'),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ReceiptText className="size-6" aria-hidden />
          </span>
          <p className="text-sm text-muted-foreground">{tm.empty}</p>
          <Button
            nativeButton={false}
            render={<Link href={`/${locale}/jobs`} />}
          >
            {tm.browseJobs}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="space-y-3">
      {data.map((q) => (
        <li key={q.id}>
          <Card>
            <CardContent className="flex items-start justify-between gap-4 p-5">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/${locale}/jobs/${q.job.id}`}
                  className="block text-base font-semibold hover:underline"
                >
                  {q.job.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tj.statusLabels[q.job.status]} ·{' '}
                  {[q.job.city, q.job.district].filter(Boolean).join(', ') ||
                    '-'}{' '}
                  · {new Date(q.createdAt).toLocaleDateString(locale)}
                </p>
                {q.message ? (
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {q.message}
                  </p>
                ) : null}
                {q.estimatedStart || q.estimatedCompletion ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {q.estimatedStart
                      ? `${t.estimatedStart}: ${new Date(q.estimatedStart).toLocaleDateString(locale)}`
                      : ''}
                    {q.estimatedStart && q.estimatedCompletion ? ' · ' : ''}
                    {q.estimatedCompletion
                      ? `${t.estimatedCompletion}: ${new Date(q.estimatedCompletion).toLocaleDateString(locale)}`
                      : ''}
                  </p>
                ) : null}
                <div className="mt-3">
                  <QuoteMaterials
                    materials={q.materials}
                    currency={q.currency}
                    calloutFee={q.calloutFee}
                    discount={q.discount}
                    vatRate={q.vatRate}
                    validUntil={q.validUntil}
                    locale={locale}
                    dict={dict}
                  />
                </div>
                {q.status === 'REJECTED' && q.rejectionReason ? (
                  <p className="mt-3 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                    <span className="font-medium">
                      {t.rejectionReasonLabel}:
                    </span>{' '}
                    {q.rejectionReason}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-2 text-right">
                <p className="font-mono text-lg font-semibold">
                  {q.currency} {Number(q.amount).toLocaleString(locale)}
                </p>
                <Badge variant={statusVariant(q.status)}>
                  {t.statusLabels[q.status]}
                </Badge>
                {q.status === 'PENDING' ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/${locale}/quotes/${q.id}/edit`} />}
                    >
                      {t.actions.edit}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (window.confirm(tm.withdrawConfirm)) {
                          withdraw.mutate(q.id);
                        }
                      }}
                      disabled={withdraw.isPending}
                    >
                      {withdraw.isPending
                        ? t.actions.withdrawing
                        : t.actions.withdraw}
                    </Button>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
