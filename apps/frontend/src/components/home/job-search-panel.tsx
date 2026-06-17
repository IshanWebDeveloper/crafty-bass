import { buttonVariants, cn } from '@repo/ui';
import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

export function JobSearchPanel({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.jobSearch;

  return (
    <div className="w-full rounded-lg border border-border bg-card p-8 shadow-soft">
      <h2 className="text-2xl font-bold tracking-tight text-foreground">
        {t.title}
      </h2>
      <ul className="mt-6 flex flex-col gap-3">
        {t.services.map((service, index) => (
          <li key={service.label}>
            <button
              type="button"
              className={cn(
                'flex w-full items-center justify-between rounded-md border border-border px-4 py-3 text-left transition-colors hover:bg-accent-soft',
                index === 0
                  ? 'bg-accent-soft text-accent-soft-foreground'
                  : 'bg-card',
              )}
            >
              <span className="text-base font-medium text-foreground">
                {service.label}
              </span>
              <span className="text-sm text-muted-foreground">
                {service.meta}
              </span>
            </button>
          </li>
        ))}
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
