'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Skeleton,
} from '@repo/ui';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getJob, cancelJob, type Job } from '@/lib/api/jobs';
import {
  listQuotesForJob,
  acceptQuote,
  rejectQuote,
  type Quote,
} from '@/lib/api/quotes';
import { startConversation } from '@/lib/api/conversations';
import { useSession } from '@/lib/auth-client';
import { SubmitQuotePanel } from './submit-quote-panel';
import { LeaveReviewPanel } from '@/components/reviews/leave-review-panel';
import { PublicReviewsList } from '@/components/reviews/public-reviews-list';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

export function JobDetailView({
  locale,
  dict,
  jobId,
}: {
  locale: Locale;
  dict: Dictionary;
  jobId: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const t = dict.jobs;
  const tq = dict.quotes;
  const tc = dict.chat;

  const { data: job, isLoading } = useQuery({
    queryKey: ['jobs', jobId],
    queryFn: () => getJob(jobId),
  });

  const isOwner = !!session && !!job && session.user.id === job.homeowner.id;

  const { data: quotes } = useQuery({
    queryKey: ['jobs', jobId, 'quotes'],
    queryFn: () => listQuotesForJob(jobId),
    enabled: isOwner,
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelJob(jobId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['jobs', jobId] });
      void qc.invalidateQueries({ queryKey: ['jobs', 'mine'] });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (quoteId: string) => acceptQuote(quoteId),
    onSuccess: () => {
      toast.success(tq.accepted);
      void qc.invalidateQueries({ queryKey: ['jobs', jobId] });
      void qc.invalidateQueries({ queryKey: ['jobs', jobId, 'quotes'] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to accept'),
  });

  const rejectMutation = useMutation({
    mutationFn: (quoteId: string) => rejectQuote(quoteId),
    onSuccess: () => {
      toast.success(tq.rejected);
      void qc.invalidateQueries({ queryKey: ['jobs', jobId, 'quotes'] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to reject'),
  });

  if (isLoading || !job) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-2xl">{job.title}</CardTitle>
            <span className="shrink-0 rounded-full border border-border px-3 py-1 text-xs font-medium">
              {t.statusLabels[job.status]}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t.detail.postedBy} {job.homeowner.name} · {t.detail.postedOn}{' '}
            {new Date(job.createdAt).toLocaleDateString(locale)}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-line text-sm">{job.description}</p>

          <dl className="grid gap-3 sm:grid-cols-3 text-sm">
            <Field label={t.fields.category}>
              {job.category?.nameEn ?? '—'}
            </Field>
            <Field label={t.fields.urgency}>
              {t.urgencyLabels[job.urgency]}
            </Field>
            <Field label={t.detail.budget}>
              {formatBudget(job.budgetMin, job.budgetMax) ?? t.detail.noBudget}
            </Field>
            <Field label={t.fields.city}>{job.city ?? '—'}</Field>
            <Field label={t.fields.district}>{job.district ?? '—'}</Field>
            <Field label={t.detail.scheduledFor}>
              {job.scheduledFor
                ? new Date(job.scheduledFor).toLocaleDateString(locale)
                : '—'}
            </Field>
          </dl>

          {isOwner &&
          (job.status === 'OPEN' ||
            job.status === 'ASSIGNED' ||
            job.status === 'IN_PROGRESS') ? (
            <div className="pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (window.confirm(t.detail.cancelConfirm)) {
                    cancelMutation.mutate();
                  }
                }}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending
                  ? t.detail.cancelling
                  : t.detail.cancelJob}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {!isOwner && session && job.status === 'OPEN' ? (
        <SubmitQuotePanel jobId={job.id} dict={dict} />
      ) : null}

      {isOwner ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t.detail.quotesHeading}</CardTitle>
          </CardHeader>
          <CardContent>
            {!quotes || quotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t.detail.noQuotes}
              </p>
            ) : (
              <ul className="space-y-3">
                {quotes.map((quote) => (
                  <QuoteRow
                    key={quote.id}
                    quote={quote}
                    job={job}
                    locale={locale}
                    dict={dict}
                    onAccept={() => acceptMutation.mutate(quote.id)}
                    onReject={() => rejectMutation.mutate(quote.id)}
                    acceptPending={acceptMutation.isPending}
                    rejectPending={rejectMutation.isPending}
                    onMessage={async () => {
                      try {
                        const result = await startConversation({
                          type: 'JOB_DIRECT',
                          jobId: job.id,
                          recipientId: quote.tradesman.id,
                          body: tc.started,
                        });
                        toast.success(tc.started);
                        router.push(
                          `/${locale}/messages/${result.conversation.id}`,
                        );
                      } catch (err) {
                        toast.error(
                          err instanceof Error
                            ? err.message
                            : 'Failed to start conversation',
                        );
                      }
                    }}
                    messageLabel={tc.startCtaTradesman}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      {job.status === 'COMPLETED' && session ? (
        <>
          {session.user.id === job.homeowner.id ||
          session.user.id === job.assignedTradesmanId ? (
            <LeaveReviewPanel jobId={job.id} dict={dict} />
          ) : null}
          <PublicReviewsList jobId={job.id} dict={dict} />
        </>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

function QuoteRow({
  quote,
  job,
  locale,
  dict,
  onAccept,
  onReject,
  acceptPending,
  rejectPending,
  onMessage,
  messageLabel,
}: {
  quote: Quote;
  job: Job;
  locale: Locale;
  dict: Dictionary;
  onAccept: () => void;
  onReject: () => void;
  acceptPending: boolean;
  rejectPending: boolean;
  onMessage: () => void;
  messageLabel: string;
}) {
  const tq = dict.quotes;
  const profile = quote.tradesman.tradesmanProfile;
  const initials =
    quote.tradesman.name
      ?.split(' ')
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() ?? '?';
  const canActOnPending = job.status === 'OPEN' && quote.status === 'PENDING';

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10">
          {quote.tradesman.image ? (
            <AvatarImage
              src={quote.tradesman.image}
              alt={quote.tradesman.name}
            />
          ) : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <p className="text-sm font-medium">{quote.tradesman.name}</p>
          {profile ? (
            <p className="text-xs text-muted-foreground">
              {tq.stats.rating
                .replace('{rating}', profile.avgRating.toFixed(1))
                .replace('{count}', String(profile.ratingCount))}{' '}
              ·{' '}
              {tq.stats.jobsCompleted.replace(
                '{count}',
                String(profile.jobsCompleted),
              )}
            </p>
          ) : null}
          {quote.message ? (
            <p className="mt-2 max-w-prose text-sm">{quote.message}</p>
          ) : null}
          {quote.estimatedStart || quote.estimatedCompletion ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {quote.estimatedStart
                ? `${tq.estimatedStart}: ${new Date(quote.estimatedStart).toLocaleDateString(locale)}`
                : ''}
              {quote.estimatedStart && quote.estimatedCompletion ? ' · ' : ''}
              {quote.estimatedCompletion
                ? `${tq.estimatedCompletion}: ${new Date(quote.estimatedCompletion).toLocaleDateString(locale)}`
                : ''}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <p className="text-lg font-semibold">
          {quote.currency} {quote.amount.toLocaleString(locale)}
        </p>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs">
          {tq.statusLabels[quote.status]}
        </span>
        {canActOnPending ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={onAccept}
              disabled={acceptPending || rejectPending}
            >
              {acceptPending ? tq.actions.accepting : tq.actions.accept}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onReject}
              disabled={acceptPending || rejectPending}
            >
              {rejectPending ? tq.actions.rejecting : tq.actions.reject}
            </Button>
          </div>
        ) : null}
        <Button size="sm" variant="ghost" onClick={onMessage}>
          {messageLabel}
        </Button>
      </div>
    </li>
  );
}

function formatBudget(min: number | null, max: number | null) {
  if (min !== null && max !== null) return `LKR ${min} – ${max}`;
  if (min !== null) return `LKR ${min}+`;
  if (max !== null) return `Up to LKR ${max}`;
  return null;
}
