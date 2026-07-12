'use client';

import { useQuery } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage, cn, Skeleton } from '@repo/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listReviewsForJob } from '@/lib/api/reviews';
import { ReportButton } from '@/components/reports/report-button';
import { TranslateButton } from '@/components/common/translate-button';
import { useSession } from '@/lib/auth-client';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

export function PublicReviewsList({
  jobId,
  locale,
  dict,
}: {
  jobId: string;
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.reviews;
  const { data: session } = useSession();
  const { data, isLoading } = useQuery({
    queryKey: ['jobs', jobId, 'reviews'],
    queryFn: () => listReviewsForJob(jobId),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t.publicHeading}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-20 rounded-lg" />
        ) : !data || data.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noPublic}</p>
        ) : (
          <ul className="space-y-4">
            {data.data.map((r) => {
              const initials =
                r.reviewer.name
                  ?.split(' ')
                  .map((p) => p[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase() ?? '?';
              return (
                <li key={r.id} className="flex gap-3">
                  <Avatar className="h-9 w-9">
                    {r.reviewer.image ? (
                      <AvatarImage
                        src={r.reviewer.image}
                        alt={r.reviewer.name}
                      />
                    ) : null}
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{r.reviewer.name}</p>
                      <StarRating value={r.rating} />
                    </div>
                    {r.title ? (
                      <p className="text-sm font-medium">{r.title}</p>
                    ) : null}
                    {r.comment ? (
                      <p className="text-sm text-muted-foreground">
                        {r.comment}
                      </p>
                    ) : null}
                    {r.title || r.comment ? (
                      <TranslateButton
                        text={[r.title, r.comment].filter(Boolean).join('\n\n')}
                        locale={locale}
                        dict={dict}
                        className="pt-0.5"
                      />
                    ) : null}
                    {session && session.user.id !== r.reviewerId ? (
                      <div className="pt-1">
                        <ReportButton
                          targetType="REVIEW"
                          targetId={r.id}
                          dict={dict}
                        />
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function StarRating({ value }: { value: number }) {
  return (
    <span className="text-sm" aria-label={`${value} stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={cn(
            n <= value ? 'text-yellow-500' : 'text-muted-foreground',
          )}
        >
          ★
        </span>
      ))}
    </span>
  );
}
