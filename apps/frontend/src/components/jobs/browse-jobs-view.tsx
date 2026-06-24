'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Lock, ShieldAlert } from 'lucide-react';
import { Button, Input, Skeleton } from '@repo/ui';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { browseJobs, type JobListQuery, type JobUrgency } from '@/lib/api/jobs';
import { listCategories } from '@/lib/api/categories';
import { getMyProfile } from '@/lib/api/profiles';
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

  // A tradesman can browse freely but can't quote until an admin verifies them.
  const { data: profile } = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: getMyProfile,
    staleTime: 60_000,
    retry: false,
  });
  const gated =
    profile?.userType === 'TRADESMAN' && !profile.tradesmanProfile?.isVerified;

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: listCategories,
    staleTime: 5 * 60_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', 'browse', filters],
    queryFn: () => browseJobs(filters),
    placeholderData: (prev) => prev,
  });

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
        <CardContent className="grid gap-4 p-5 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="filter-category">{t.browse.filters.category}</Label>
            <NativeSelect
              id="filter-category"
              value={filters.categoryId ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  categoryId: e.target.value || undefined,
                }))
              }
            >
              <option value="">{t.browse.filters.allCategories}</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameEn}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-district">{t.browse.filters.district}</Label>
            <Input
              id="filter-district"
              placeholder={t.browse.filters.districtPlaceholder}
              value={filters.district ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  district: e.target.value || undefined,
                }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-urgency">{t.browse.filters.urgency}</Label>
            <NativeSelect
              id="filter-urgency"
              value={filters.urgency ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  urgency: (e.target.value || undefined) as
                    | JobUrgency
                    | undefined,
                }))
              }
            >
              <option value="">{t.browse.filters.allUrgencies}</option>
              {URGENCY_OPTIONS.map((u) => (
                <option key={u} value={u}>
                  {t.urgencyLabels[u]}
                </option>
              ))}
            </NativeSelect>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : !data || data.data.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            {t.browse.empty}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {data.data.map((job) => (
            <li key={job.id}>
              <Card>
                <CardContent className="flex items-start justify-between gap-4 p-5">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/${locale}/jobs/${job.id}`}
                      className="block text-base font-semibold hover:underline"
                    >
                      {job.title}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {job.category?.nameEn ?? '—'} ·{' '}
                      {t.urgencyLabels[job.urgency]} ·{' '}
                      {[job.city, job.district].filter(Boolean).join(', ') ||
                        '—'}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {job.description}
                    </p>
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
