'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button, Skeleton } from '@repo/ui';
import { Card, CardContent } from '@/components/ui/card';
import { listMyQuotes } from '@/lib/api/quotes';
import { SubmitQuotePanel } from '@/components/jobs/submit-quote-panel';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

export function EditQuoteForm({
  locale,
  dict,
  quoteId,
}: {
  locale: Locale;
  dict: Dictionary;
  quoteId: string;
}) {
  const tm = dict.myQuotes;

  const { data, isLoading } = useQuery({
    queryKey: ['my-quotes'],
    queryFn: listMyQuotes,
  });

  if (isLoading) {
    return <Skeleton className="h-96 rounded-xl" />;
  }

  const quote = data?.find((q) => q.id === quoteId);

  // Only a pending quote on a still-open job can be edited; otherwise the
  // homeowner has already acted on it (or withdrawn), so there's nothing to change.
  if (!quote || quote.status !== 'PENDING') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
          <p className="text-sm text-muted-foreground">{tm.notEditable}</p>
          <Button
            nativeButton={false}
            render={<Link href={`/${locale}/quotes`} />}
          >
            {tm.backToQuotes}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <SubmitQuotePanel
      mode="edit"
      quoteId={quote.id}
      jobId={quote.job.id}
      initial={quote}
      locale={locale}
      dict={dict}
    />
  );
}
