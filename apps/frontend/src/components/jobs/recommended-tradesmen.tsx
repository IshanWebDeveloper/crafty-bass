'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  RatingStars,
  Skeleton,
  VerifiedBadge,
} from '@repo/ui';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getJobRecommendations,
  refreshJobRecommendations,
  type JobRecommendation,
  type RecommendationReasons,
} from '@/lib/api/recommendations';
import { startConversation } from '@/lib/api/conversations';
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

export function RecommendedTradesmen({
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
  const t = dict.jobs.recommendations;

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', jobId, 'recommendations'],
    queryFn: () => getJobRecommendations(jobId),
  });

  const refreshMutation = useMutation({
    mutationFn: () => refreshJobRecommendations(jobId),
    onSuccess: (fresh) => {
      qc.setQueryData(['jobs', jobId, 'recommendations'], fresh);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to refresh'),
  });

  async function message(tradesmanId: string) {
    try {
      const result = await startConversation({
        type: 'JOB_DIRECT',
        jobId,
        recipientId: tradesmanId,
      });
      router.push(`/${locale}/messages/${result.conversation.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to start conversation',
      );
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-lg">{t.heading}</CardTitle>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
        >
          <RefreshCw
            className={`h-4 w-4${refreshMutation.isPending ? ' animate-spin' : ''}`}
            aria-hidden
          />
          {refreshMutation.isPending ? t.refreshing : t.refresh}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.empty}</p>
        ) : (
          <ul className="space-y-3">
            {data.map((rec) => (
              <RecommendationRow
                key={rec.id}
                rec={rec}
                locale={locale}
                dict={dict}
                onMessage={() => message(rec.tradesmanId)}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RecommendationRow({
  rec,
  locale,
  dict,
  onMessage,
}: {
  rec: JobRecommendation;
  locale: Locale;
  dict: Dictionary;
  onMessage: () => void;
}) {
  const t = dict.jobs.recommendations;
  const profile = rec.tradesman.tradesmanProfile;
  const scorePct = Math.round(Number(rec.score) * 100);

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center">
          <span className="text-xs font-medium text-muted-foreground">
            #{rec.rank}
          </span>
          <Avatar className="mt-1 h-10 w-10">
            {rec.tradesman.image ? (
              <AvatarImage src={rec.tradesman.image} alt={rec.tradesman.name} />
            ) : null}
            <AvatarFallback>{initialsOf(rec.tradesman.name)}</AvatarFallback>
          </Avatar>
        </div>
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            {rec.tradesman.name}
            {profile?.isVerified ? (
              <VerifiedBadge size={15} title={t.verified} />
            ) : null}
          </p>
          {profile ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <RatingStars
                value={Number(profile.avgRating)}
                count={profile.ratingCount}
              />
              <span className="text-xs text-muted-foreground">
                ·{' '}
                {t.jobsCompleted.replace(
                  '{count}',
                  String(profile.jobsCompleted),
                )}
              </span>
              {profile.city || profile.district ? (
                <span className="text-xs text-muted-foreground">
                  ·{' '}
                  {[profile.city, profile.district].filter(Boolean).join(', ')}
                </span>
              ) : null}
            </div>
          ) : null}
          {rec.reasons ? (
            <FactorBars reasons={rec.reasons} dict={dict} />
          ) : null}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <Badge variant="secondary" className="font-mono">
          {t.matchScore} {scorePct}%
        </Badge>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href={`/${locale}/trades/${rec.tradesmanId}`} />}
          >
            {t.viewProfile}
          </Button>
          <Button size="sm" variant="ghost" onClick={onMessage}>
            {t.message}
          </Button>
        </div>
      </div>
    </li>
  );
}

function FactorBars({
  reasons,
  dict,
}: {
  reasons: RecommendationReasons;
  dict: Dictionary;
}) {
  const t = dict.jobs.recommendations.factors;
  const factors: Array<{ label: string; value: number }> = [
    { label: t.reputation, value: reasons.subScores.reputation },
    { label: t.proximity, value: reasons.subScores.proximity },
    { label: t.completion, value: reasons.subScores.completion },
    { label: t.response, value: reasons.subScores.response },
  ];

  return (
    <div className="mt-2 grid max-w-md grid-cols-2 gap-x-4 gap-y-1.5">
      {factors.map((f) => (
        <div key={f.label} className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-xs text-muted-foreground">
            {f.label}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.round(f.value * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
