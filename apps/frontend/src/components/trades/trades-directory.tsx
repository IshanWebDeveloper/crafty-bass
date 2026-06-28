'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { MapPin, ChevronDown, Users, Languages } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Combobox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  RatingStars,
  Skeleton,
  Tag,
  VerifiedBadge,
} from '@repo/ui';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  browseTradesmen,
  type TradesmanListItem,
  type TradesmenQuery,
} from '@/lib/api/profiles';
import { listCategories } from '@/lib/api/categories';
import { CategoryIcon } from '@/lib/categories';
import { DISTRICT_OPTIONS } from '@/lib/districts';
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

  const selectedCategory = categories?.find((c) => c.id === filters.categoryId);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="trades-category">{t.filters.category}</Label>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    id="trades-category"
                    variant="outline"
                    className="h-9 w-full justify-between font-normal"
                  >
                    <span className="flex items-center gap-1.5">
                      {selectedCategory ? (
                        <>
                          <CategoryIcon
                            slug={selectedCategory.slug}
                            className="size-4"
                          />
                          {selectedCategory.nameEn}
                        </>
                      ) : (
                        t.filters.allCategories
                      )}
                    </span>
                    <ChevronDown className="size-4 opacity-60" />
                  </Button>
                }
              />
              <DropdownMenuContent className="min-w-(--anchor-width)">
                <DropdownMenuRadioGroup
                  value={filters.categoryId ?? ''}
                  onValueChange={(value) =>
                    setFilters((f) => ({
                      ...f,
                      categoryId: (value as string) || undefined,
                    }))
                  }
                >
                  <DropdownMenuRadioItem value="">
                    {t.filters.allCategories}
                  </DropdownMenuRadioItem>
                  {categories?.map((c) => (
                    <DropdownMenuRadioItem
                      key={c.id}
                      value={c.id}
                      className="gap-2"
                    >
                      <CategoryIcon slug={c.slug} className="size-4" />
                      {c.nameEn}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trades-district">{t.filters.district}</Label>
            <Combobox
              id="trades-district"
              items={DISTRICT_OPTIONS}
              value={filters.district ?? null}
              onValueChange={(value) =>
                setFilters((f) => ({ ...f, district: value ?? undefined }))
              }
              placeholder={t.filters.districtPlaceholder}
              emptyText={t.filters.districtEmpty}
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
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Users className="size-6" aria-hidden />
            </span>
            <p className="text-sm text-muted-foreground">{t.empty}</p>
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
          <span className="inline-flex items-center gap-1">
            <Languages className="size-3.5" aria-hidden />
            {dict.profile.languages[trade.preferredLanguage]}
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
