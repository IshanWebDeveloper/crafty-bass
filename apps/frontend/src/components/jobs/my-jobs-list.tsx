'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, ChevronDown, Search, X } from 'lucide-react';
import {
  Badge,
  Button,
  Input,
  Skeleton,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@repo/ui';
import { Card, CardContent } from '@/components/ui/card';
import { listMyJobs, type JobStatus } from '@/lib/api/jobs';
import { statusVariant } from '@/lib/status';
import { CategoryBadge, CategoryIcon } from '@/lib/categories';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

const STATUS_OPTIONS: JobStatus[] = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'DISPUTED',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
];

export function MyJobsList({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.jobs;
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<JobStatus | ''>('');
  const [categoryId, setCategoryId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', 'mine'],
    queryFn: () => listMyJobs({ limit: 50 }),
  });

  const jobs = useMemo(() => data?.data ?? [], [data]);

  // Category options are derived from the homeowner's own jobs rather than the
  // full catalogue, so the dropdown only ever offers categories they can match.
  const categoryOptions = useMemo(() => {
    const byId = new Map<
      string,
      { id: string; slug: string; nameEn: string }
    >();
    for (const job of jobs) {
      if (job.category) byId.set(job.category.id, job.category);
    }
    return [...byId.values()].sort((a, b) => a.nameEn.localeCompare(b.nameEn));
  }, [jobs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((job) => {
      if (status && job.status !== status) return false;
      if (categoryId && job.category?.id !== categoryId) return false;
      if (q) {
        const haystack = [
          job.title,
          job.description,
          job.city,
          job.district,
          job.category?.nameEn,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [jobs, search, status, categoryId]);

  const hasFilters = search.trim() !== '' || status !== '' || categoryId !== '';
  const selectedCategory = categoryOptions.find((c) => c.id === categoryId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  // No jobs at all: keep the original onboarding empty state (no filter bar).
  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ClipboardList className="size-6" aria-hidden />
          </span>
          <p className="text-sm text-muted-foreground">{t.mine.empty}</p>
          <Button
            nativeButton={false}
            render={<Link href={`/${locale}/jobs/new`} />}
          >
            {t.mine.postOne}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setCategoryId('');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2.5 p-4">
          <div className="relative min-w-52 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.mine.searchPlaceholder}
              aria-label={t.mine.searchPlaceholder}
              className="pl-8"
            />
          </div>

          {/* Status filter */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={t.mine.allStatuses}
                >
                  {status ? t.statusLabels[status] : t.mine.allStatuses}
                  <ChevronDown className="size-4 opacity-60" />
                </Button>
              }
            />
            <DropdownMenuContent className="min-w-44">
              <DropdownMenuRadioGroup
                value={status}
                onValueChange={(value) => setStatus((value as JobStatus) || '')}
              >
                <DropdownMenuRadioItem value="">
                  {t.mine.allStatuses}
                </DropdownMenuRadioItem>
                {STATUS_OPTIONS.map((s) => (
                  <DropdownMenuRadioItem key={s} value={s}>
                    {t.statusLabels[s]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Category filter - only when the homeowner has jobs across categories */}
          {categoryOptions.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={t.mine.allCategories}
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
                        t.mine.allCategories
                      )}
                    </span>
                    <ChevronDown className="size-4 opacity-60" />
                  </Button>
                }
              />
              <DropdownMenuContent className="min-w-48">
                <DropdownMenuRadioGroup
                  value={categoryId}
                  onValueChange={(value) =>
                    setCategoryId((value as string) || '')
                  }
                >
                  <DropdownMenuRadioItem value="">
                    {t.mine.allCategories}
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
          ) : null}

          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="size-3.5" aria-hidden />
              {t.mine.clearFilters}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Search className="size-6" aria-hidden />
            </span>
            <p className="text-sm text-muted-foreground">{t.mine.noMatches}</p>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              {t.mine.clearFilters}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {(filtered.length === 1
              ? t.mine.resultCountOne
              : t.mine.resultCount
            )
              .replace('{count}', String(filtered.length))
              .replace('{total}', String(jobs.length))}
          </p>
          <ul className="space-y-3">
            {filtered.map((job) => (
              <li key={job.id}>
                <Card>
                  <CardContent className="flex items-start justify-between gap-4 p-5">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2">
                        <CategoryBadge
                          slug={job.category?.slug}
                          label={job.category?.nameEn ?? '-'}
                        />
                      </div>
                      <Link
                        href={`/${locale}/jobs/${job.id}`}
                        className="block text-base font-semibold hover:underline"
                      >
                        {job.title}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(job.createdAt).toLocaleDateString(locale)} ·{' '}
                        {[job.city, job.district].filter(Boolean).join(', ') ||
                          '-'}
                      </p>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {job.description}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-right">
                      <Badge variant={statusVariant(job.status)}>
                        {t.statusLabels[job.status]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {(job._count.quotes === 1
                          ? t.mine.viewQuotesOne
                          : t.mine.viewQuotes
                        ).replace('{count}', String(job._count.quotes))}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
