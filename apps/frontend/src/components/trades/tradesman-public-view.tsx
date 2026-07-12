'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Award, MapPin, Truck } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  RatingStars,
  Skeleton,
  Tag,
  VerifiedBadge,
} from '@repo/ui';
import { Card, CardContent } from '@/components/ui/card';
import { getTradesmanPublic } from '@/lib/api/profiles';
import { RoleBadge } from '@/components/layout/role-badge';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

function initialsOf(name: string) {
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

export function TradesmanPublicView({
  locale,
  dict,
  userId,
}: {
  locale: Locale;
  dict: Dictionary;
  userId: string;
}) {
  const t = dict.trades.profile;
  const {
    data: trade,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['tradesman', userId],
    queryFn: () => getTradesmanPublic(userId),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  if (isError || !trade) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          {t.notFound}
        </CardContent>
      </Card>
    );
  }

  const location = [trade.city, trade.district].filter(Boolean).join(', ');
  const stats = [
    { label: t.stats.rating, value: trade.avgRating.toFixed(1) },
    { label: t.stats.completed, value: String(trade.jobsCompleted) },
    {
      label: t.stats.experience,
      value: t.years.replace('{count}', String(trade.yearsExperience)),
    },
    {
      label: t.stats.response,
      value:
        trade.responseTimeMinutes > 0
          ? t.minutes.replace('{count}', String(trade.responseTimeMinutes))
          : '—',
    },
  ];

  return (
    <div className="space-y-6">
      <Link
        href={`/${locale}/trades`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t.back}
      </Link>

      <Card className="shadow-card">
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Avatar className="size-16">
              {trade.image ? (
                <AvatarImage src={trade.image} alt={trade.name} />
              ) : null}
              <AvatarFallback className="text-lg">
                {initialsOf(trade.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                {trade.name}
                {trade.isVerified ? <VerifiedBadge size={18} /> : null}
              </h1>
              <RoleBadge
                userType="TRADESMAN"
                primaryTrade={trade.primaryTrade}
                dict={dict}
                className="mt-1.5"
              />
              <RatingStars
                value={trade.avgRating}
                count={trade.ratingCount}
                className="mt-1.5"
              />
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {location ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-4" aria-hidden />
                    {location}
                  </span>
                ) : null}
                <Badge variant={trade.isAvailable ? 'success' : 'muted'}>
                  {trade.isAvailable ? t.available : t.unavailable}
                </Badge>
              </div>
            </div>
          </div>
          <Button
            nativeButton={false}
            render={<Link href={`/${locale}/messages`} />}
          >
            {t.message}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-5 p-6">
            <section>
              <h2 className="text-sm font-semibold">{t.about}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {trade.bio || t.noBio}
              </p>
            </section>
            <section>
              <h2 className="text-sm font-semibold">{t.skills}</h2>
              {trade.skills.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {trade.skills.map((s) => (
                    <Tag key={s.id} variant="soft">
                      {s.nameEn}
                    </Tag>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  {t.noSkills}
                </p>
              )}
            </section>
            {trade.certifications.length > 0 ? (
              <section>
                <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                  <Award className="size-4 text-muted-foreground" aria-hidden />
                  {t.certifications}
                </h2>
                <ul className="mt-2 space-y-1.5">
                  {trade.certifications.map((c) => (
                    <li
                      key={c}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <span
                        className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50"
                        aria-hidden
                      />
                      {c}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {trade.vehicles.length > 0 ? (
              <section>
                <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                  <Truck className="size-4 text-muted-foreground" aria-hidden />
                  {t.vehicles}
                </h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {trade.vehicles.map((v) => (
                    <Tag key={v} variant="soft">
                      {v}
                    </Tag>
                  ))}
                </div>
              </section>
            ) : null}
            {trade.portfolio.length > 0 ? (
              <section>
                <h2 className="text-sm font-semibold">{t.portfolio}</h2>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {trade.portfolio.map((url) => (
                    // Presigned R2 URL — plain img avoids next/image config.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={url}
                      src={url}
                      alt=""
                      className="aspect-square w-full rounded-lg border border-border object-cover"
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid grid-cols-2 gap-4 p-6">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-lg font-semibold tracking-tight">
                  {s.value}
                </p>
              </div>
            ))}
            {trade.hourlyRate != null ? (
              <div className="col-span-2 border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">{t.hourlyRate}</p>
                <p className="mt-1 font-mono text-lg font-semibold">
                  LKR {trade.hourlyRate.toLocaleString('en-US')}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
