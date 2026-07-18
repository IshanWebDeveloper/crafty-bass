'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage, Button } from '@repo/ui';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getJobAgreement, type Job } from '@/lib/api/jobs';
import { QuoteMaterials } from '@/components/quotes/quote-materials';
import { startConversation } from '@/lib/api/conversations';
import { formatLKR } from '@/lib/currency';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

function initialsOf(name: string): string {
  return (
    name
      .split(' ')
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

/**
 * The agreed-terms card shown once a job is assigned (status !== OPEN), for both
 * the homeowner and the assigned tradesman. It keeps the agreed price, estimated
 * dates and the counterpart visible for the life of the job - and carries a
 * persistent Message action - so neither party loses the thread when the quotes
 * card unmounts (and, for no-deposit jobs, when there is no escrow card either).
 * The agreed figures come from the party-only `/jobs/:id/agreement` endpoint.
 */
export function AgreedQuoteSummary({
  job,
  isOwner,
  locale,
  dict,
}: {
  job: Job;
  isOwner: boolean;
  locale: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const t = dict.jobs.detail.agreedSummary;
  const tq = dict.quotes;
  const tc = dict.chat;

  const { data: agreement } = useQuery({
    queryKey: ['jobs', job.id, 'agreement'],
    queryFn: () => getJobAgreement(job.id),
  });

  // The owner sees the tradesman they hired; the tradesman sees the homeowner.
  // assignedTradesman comes from the agreement fetch (with an avatar); the
  // homeowner is on the public job payload (name only).
  const counterparty = isOwner
    ? agreement?.assignedTradesman
      ? {
          name: agreement.assignedTradesman.name,
          image: agreement.assignedTradesman.image,
        }
      : null
    : { name: job.homeowner.name, image: null };

  const quote = agreement?.acceptedQuote ?? null;

  const onMessage = async () => {
    try {
      const result = await startConversation({
        type: 'JOB_DIRECT',
        jobId: job.id,
        // The owner must name the recipient; the tradesman's counterpart (the
        // homeowner) is derived server-side, so it is omitted there.
        recipientId: isOwner
          ? (job.assignedTradesmanId ?? undefined)
          : undefined,
        // No body: just open (or reuse) the thread and let the user type their
        // own message, rather than auto-sending a placeholder.
      });
      router.push(`/${locale}/messages/${result.conversation.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to start conversation',
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t.heading}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {counterparty ? (
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                {counterparty.image ? (
                  <AvatarImage
                    src={counterparty.image}
                    alt={counterparty.name}
                  />
                ) : null}
                <AvatarFallback>{initialsOf(counterparty.name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {isOwner ? t.counterpartyOwner : t.counterpartyTradesman}
                </p>
                <p className="text-sm font-medium">{counterparty.name}</p>
              </div>
            </div>
          ) : (
            <span />
          )}
          <Button size="sm" variant="outline" onClick={onMessage}>
            {counterparty
              ? tc.startCtaNamed.replace('{name}', counterparty.name)
              : isOwner
                ? tc.startCtaTradesman
                : tc.startCta}
          </Button>
        </div>

        {quote ? (
          <>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t.agreedPrice}
                </dt>
                <dd className="mt-1 font-mono font-semibold">
                  {formatLKR(quote.amount, quote.currency)}
                </dd>
              </div>
              {quote.estimatedStart ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {tq.estimatedStart}
                  </dt>
                  <dd className="mt-1">
                    {new Date(quote.estimatedStart).toLocaleDateString(locale)}
                  </dd>
                </div>
              ) : null}
              {quote.estimatedCompletion ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {tq.estimatedCompletion}
                  </dt>
                  <dd className="mt-1">
                    {new Date(quote.estimatedCompletion).toLocaleDateString(
                      locale,
                    )}
                  </dd>
                </div>
              ) : null}
            </dl>
            <QuoteMaterials
              materials={quote.materials}
              currency={quote.currency}
              calloutFee={quote.calloutFee}
              discount={quote.discount}
              vatRate={quote.vatRate}
              locale={locale}
              dict={dict}
            />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
