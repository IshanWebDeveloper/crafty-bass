'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Input,
  RatingStars,
  Skeleton,
  Tag,
  VerifiedBadge,
} from '@repo/ui';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import {
  browseTradesmen,
  type TradesmanListItem,
  type TradesmenQuery,
} from '@/lib/api/profiles';
import { listCategories } from '@/lib/api/categories';
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

export function TradesDirectory({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.trades;
  const [filters, setFilters] = useState<TradesmenQuery>({ limit: 24 });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: listCategories,
    staleTime: 5 * 60_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['tradesmen', filters],
    queryFn: () => browseTradesmen(filters),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="trades-category">{t.filters.category}</Label>
            <NativeSelect
              id="trades-category"
              value={filters.categoryId ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  categoryId: e.target.value || undefined,
                }))
              }
            >
              <option value="">{t.filters.allCategories}</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameEn}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trades-district">{t.filters.district}</Label>
            <Input
              id="trades-district"
              placeholder={t.filters.districtPlaceholder}
              value={filters.district ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  district: e.target.value || undefined,
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : !data || data.data.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            {t.empty}
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.data.map((trade) => (
            <li key={trade.userId}>
              <TradeCard locale={locale} dict={dict} trade={trade} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TradeCard({
  locale,
  dict,
  trade,
}: {
  locale: Locale;
  dict: Dictionary;
  trade: TradesmanListItem;
}) {
  const t = dict.trades;
  const location = [trade.city, trade.district].filter(Boolean).join(', ');

  return (
    <Card className="flex h-full flex-col shadow-card transition-shadow hover:shadow-elevated">
      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-center gap-3">
          <Avatar className="size-11">
            {trade.image ? (
              <AvatarImage src={trade.image} alt={trade.name} />
            ) : null}
            <AvatarFallback>{initialsOf(trade.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <span className="truncate">{trade.name}</span>
              {trade.isVerified ? <VerifiedBadge size={15} /> : null}
            </p>
            <RatingStars
              value={trade.avgRating}
              count={trade.ratingCount}
              className="mt-0.5"
            />
          </div>
        </div>

        {trade.bio ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {trade.bio}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {location ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {location}
            </span>
          ) : null}
          <span>
            {t.jobsCompleted.replace('{count}', String(trade.jobsCompleted))}
          </span>
        </div>

        {trade.skills.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {trade.skills.slice(0, 3).map((s) => (
              <Tag key={s.id} variant="soft">
                {s.nameEn}
              </Tag>
            ))}
            {trade.skills.length > 3 ? (
              <Tag variant="muted">+{trade.skills.length - 3}</Tag>
            ) : null}
          </div>
        ) : null}

        <Button
          variant="outline"
          className="mt-auto w-full"
          nativeButton={false}
          render={<Link href={`/${locale}/trades/${trade.userId}`} />}
        >
          {t.viewProfile}
        </Button>
      </CardContent>
    </Card>
  );
}
