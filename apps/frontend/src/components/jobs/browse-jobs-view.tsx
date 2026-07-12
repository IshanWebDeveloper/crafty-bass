'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Lock, ShieldAlert, ChevronDown, MapPin } from 'lucide-react';
import {
  Button,
  Combobox,
  Skeleton,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@repo/ui';
import { Card, CardContent } from '@/components/ui/card';
import { browseJobs, type JobListQuery, type JobUrgency } from '@/lib/api/jobs';
import { listCategories } from '@/lib/api/categories';
import { getMyProfile } from '@/lib/api/profiles';
import { DISTRICT_OPTIONS } from '@/lib/districts';
import { JobExpiryBadge } from '@/components/jobs/job-expiry-badge';
import { TranslateButton } from '@/components/common/translate-button';
import { CategoryBadge, CategoryIcon, UrgencyBadge } from '@/lib/categories';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

const URGENCY_OPTIONS: JobUrgency[] = ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'];

export function BrowseJobsView({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.jobs;
  const [filters, setFilters] = useState<JobListQuery>({ limit: 20 });
  const [onlyRelevant, setOnlyRelevant] = useState(true);

  // A tradesman can browse freely but can't quote until an admin verifies them.
  const { data: profile } = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: getMyProfile,
    staleTime: 60_000,
    retry: false,
  });
  const tradesmanProfile = profile?.tradesmanProfile;
  const isTradesman = profile?.userType === 'TRADESMAN';
  const gated = isTradesman && !tradesmanProfile?.isVerified;

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: listCategories,
    staleTime: 5 * 60_000,
  });

  // The tradesman's relevant trades are the categories their skills belong to
  // (skill slugs are prefixed with their category slug, e.g. `plumbing-leak…`).
  const myCategories = useMemo(() => {
    if (!isTradesman || !categories || !tradesmanProfile?.skills?.length) {
      return [];
    }
    const skillSlugs = tradesmanProfile.skills.map((s) => s.skill.slug);
    return categories.filter((c) =>
      skillSlugs.some(
        (slug) => slug === c.slug || slug.startsWith(`${c.slug}-`),
      ),
    );
  }, [isTradesman, categories, tradesmanProfile]);

  const myCategoryIds = useMemo(
    () => new Set(myCategories.map((c) => c.id)),
    [myCategories],
  );
  const myDistrict = tradesmanProfile?.district ?? null;

  // Only tradesmen with at least one derivable trade can scope to "my trades".
  const canScope = isTradesman && myCategories.length > 0;
  const relevant = canScope && onlyRelevant;

  // In relevant mode the area is locked to the tradesman's district; categories
  // the server can only filter one at a time, so a multi-trade view is narrowed
  // client-side below.
  const queryFilters: JobListQuery = {
    ...filters,
    district: relevant ? (myDistrict ?? undefined) : filters.district,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', 'browse', queryFilters, relevant],
    queryFn: () => browseJobs(queryFilters),
    placeholderData: (prev) => prev,
  });

  const visibleJobs = useMemo(() => {
    const list = data?.data ?? [];
    if (relevant && !filters.categoryId && myCategoryIds.size > 0) {
      return list.filter((j) => j.category && myCategoryIds.has(j.category.id));
    }
    return list;
  }, [data, relevant, filters.categoryId, myCategoryIds]);

  const categoryOptions = relevant ? myCategories : (categories ?? []);
  const selectedCategory = categories?.find((c) => c.id === filters.categoryId);
  const allCategoriesLabel = relevant
    ? t.browse.filters.allMyTrades
    : t.browse.filters.allCategories;

  return (
    <div className="space-y-6">
      {gated ? (
        <div className="flex flex-wrap items-center gap-3.5 rounded-lg bg-warning-subtle px-4 py-3.5 text-warning-foreground">
          <ShieldAlert className="size-5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t.browse.gate.title}</p>
            <p className="mt-0.5 text-xs">{t.browse.gate.body}</p>
          </div>
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href={`/${locale}/account/get-verified`} />}
          >
            {t.browse.gate.cta}
          </Button>
        </div>
      ) : null}

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2.5">
            {canScope ? (
              <div className="inline-flex rounded-lg border border-border p-0.5">
                <Button
                  size="sm"
                  variant={onlyRelevant ? 'default' : 'ghost'}
                  onClick={() => setOnlyRelevant(true)}
                >
                  {t.browse.relevance.myTrades}
                </Button>
                <Button
                  size="sm"
                  variant={!onlyRelevant ? 'default' : 'ghost'}
                  onClick={() => setOnlyRelevant(false)}
                >
                  {t.browse.relevance.allJobs}
                </Button>
              </div>
            ) : null}

            {/* Category filter - shadcn dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={t.browse.filters.category}
                  >
                    <span className="flex items-center gap-1.5">
                      {selectedCategory ? (
                        <>
                          <CategoryIcon
                            slug={selectedCategory.slug}
                            className="size-3.5"
                          />
                          {selectedCategory.nameEn}
                        </>
                      ) : (
                        allCategoriesLabel
                      )}
                    </span>
                    <ChevronDown className="size-4 opacity-60" />
                  </Button>
                }
              />
              <DropdownMenuContent className="min-w-48">
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
                    {allCategoriesLabel}
                  </DropdownMenuRadioItem>
                  {categoryOptions.map((c) => (
                    <DropdownMenuRadioItem
                      key={c.id}
                      value={c.id}
                      className="gap-2"
                    >
                      <CategoryIcon slug={c.slug} className="size-3.5" />
                      {c.nameEn}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Location - locked to the tradesman's area when scoped */}
            {relevant ? (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-muted px-2.5 text-[0.8rem] text-muted-foreground">
                <MapPin className="size-3.5" />
                {myDistrict ?? t.browse.relevance.anywhere}
              </span>
            ) : (
              <div className="w-44">
                <Combobox
                  aria-label={t.browse.filters.district}
                  items={DISTRICT_OPTIONS}
                  value={filters.district ?? null}
                  onValueChange={(value) =>
                    setFilters((f) => ({ ...f, district: value ?? undefined }))
                  }
                  placeholder={t.browse.filters.districtPlaceholder}
                  emptyText={t.browse.filters.districtEmpty}
                  className="h-7 text-[0.8rem]"
                />
              </div>
            )}

            {/* Urgency filter - shadcn dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={t.browse.filters.urgency}
                  >
                    {filters.urgency
                      ? t.urgencyLabels[filters.urgency]
                      : t.browse.filters.allUrgencies}
                    <ChevronDown className="size-4 opacity-60" />
                  </Button>
                }
              />
              <DropdownMenuContent className="min-w-44">
                <DropdownMenuRadioGroup
                  value={filters.urgency ?? ''}
                  onValueChange={(value) =>
                    setFilters((f) => ({
                      ...f,
                      urgency: (value as JobUrgency) || undefined,
                    }))
                  }
                >
                  <DropdownMenuRadioItem value="">
                    {t.browse.filters.allUrgencies}
                  </DropdownMenuRadioItem>
                  {URGENCY_OPTIONS.map((u) => (
                    <DropdownMenuRadioItem key={u} value={u}>
                      {t.urgencyLabels[u]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {relevant ? (
            <p className="text-xs text-muted-foreground">
              {t.browse.relevance.hint}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : visibleJobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ShieldAlert className="size-6" aria-hidden />
            </span>
            <p className="text-sm text-muted-foreground">
              {relevant ? t.browse.relevance.empty : t.browse.empty}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {visibleJobs.map((job) => (
            <li key={job.id}>
              <Card>
                <CardContent className="flex items-start justify-between gap-4 p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CategoryBadge
                        slug={job.category?.slug}
                        label={job.category?.nameEn ?? '-'}
                      />
                      <UrgencyBadge
                        urgency={job.urgency}
                        label={t.urgencyLabels[job.urgency]}
                      />
                      <JobExpiryBadge job={job} dict={dict} />
                    </div>
                    <Link
                      href={`/${locale}/jobs/${job.id}`}
                      className="mt-2 block text-base font-semibold hover:underline"
                    >
                      {job.title}
                    </Link>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3.5 shrink-0" aria-hidden />
                      {[job.city, job.district].filter(Boolean).join(', ') ||
                        '-'}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {job.description}
                    </p>
                    {job.description ? (
                      <TranslateButton
                        text={`${job.title}\n\n${job.description}`}
                        locale={locale}
                        dict={dict}
                        className="mt-2"
                      />
                    ) : null}
                  </div>
                  {gated ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled
                      title={t.browse.gate.quoteLocked}
                      className="shrink-0"
                    >
                      <Lock className="size-3.5" aria-hidden />
                      {t.browse.quote}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      nativeButton={false}
                      render={<Link href={`/${locale}/jobs/${job.id}`} />}
                    >
                      {t.browse.quote}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
