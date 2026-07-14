import { buttonVariants, cn } from '@repo/ui';
import Link from 'next/link';
import { CategoryIconBubble } from '@/lib/categories';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import type { CategoryTradesmanCount } from '@/lib/api/stats.server';

export function JobSearchPanel({
  locale,
  dict,
  counts,
}: {
  locale: Locale;
  dict: Dictionary;
  counts: CategoryTradesmanCount[] | null;
}) {
  const t = dict.jobSearch;
  // Live available-tradesman count per category slug; when the fetch failed
  // (null) we keep each row's static marketing `meta` string instead.
  const countBySlug = counts
    ? new Map(counts.map((c) => [c.slug, c.count]))
    : null;

  return (
    <div className="w-full rounded-lg border border-border bg-card p-8 shadow-soft">
      <h2 className="text-2xl font-bold tracking-tight text-foreground">
        {t.title}
      </h2>
      <ul className="mt-6 flex flex-col gap-3">
        {t.services.map((service, index) => {
          const live = countBySlug?.get(service.slug);
          const meta =
            live !== undefined ? `${live} ${t.matches}` : service.meta;
          return (
            <li key={service.label}>
              <button
                type="button"
                className={cn(
                  'flex w-full items-center gap-3 rounded-md border border-border px-4 py-3 text-left transition-colors hover:bg-accent-soft',
                  index === 0
                    ? 'bg-accent-soft text-accent-soft-foreground'
                    : 'bg-card',
                )}
              >
                <CategoryIconBubble slug={service.slug} className="size-9" />
                <span className="text-base font-medium text-foreground">
                  {service.label}
                </span>
                <span className="ml-auto text-sm text-muted-foreground">
                  {meta}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <Link
        href={`/${locale}/trades`}
        className={cn(
          buttonVariants({ size: 'lg' }),
          'mt-6 h-11 w-full rounded-md text-sm',
        )}
      >
        {t.findMatches}
      </Link>
    </div>
  );
}
