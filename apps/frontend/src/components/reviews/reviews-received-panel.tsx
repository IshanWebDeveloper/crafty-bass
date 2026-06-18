'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage, cn, Skeleton } from '@repo/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listMyReviewsReceived } from '@/lib/api/reviews';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

export function ReviewsReceivedPanel({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.reviews;
  const { data, isLoading } = useQuery({
    queryKey: ['reviews', 'received'],
    queryFn: listMyReviewsReceived,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t.receivedHeading}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-20 rounded-lg" />
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.receivedEmpty}</p>
        ) : (
          <ul className="space-y-4">
            {data.map((r) => {
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
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">
                        {r.reviewer.name}
                      </p>
                      <span
                        aria-label={`${r.rating} stars`}
                        className="text-sm"
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span
                            key={n}
                            className={cn(
                              n <= r.rating
                                ? 'text-yellow-500'
                                : 'text-muted-foreground',
                            )}
                          >
                            ★
                          </span>
                        ))}
                      </span>
                    </div>
                    <Link
                      href={`/${locale}/jobs/${r.job.id}`}
                      className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                    >
                      {r.job.title}
                    </Link>
                    {r.title ? (
                      <p className="text-sm font-medium">{r.title}</p>
                    ) : null}
                    {r.comment ? (
                      <p className="text-sm text-muted-foreground">
                        {r.comment}
                      </p>
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
