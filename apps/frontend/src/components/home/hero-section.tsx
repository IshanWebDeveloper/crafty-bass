import Link from 'next/link';
import { buttonVariants, cn } from '@repo/ui';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { JobSearchPanel } from './job-search-panel';

export function HeroSection({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const hero = dict.hero;
  const stats = [
    { value: '420+', label: hero.stats.activeTrades },
    { value: '2h', label: hero.stats.avgResponse },
    { value: '9.1k', label: hero.stats.verifiedReviews },
  ];

  return (
    <section className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 py-12 lg:grid-cols-2 lg:gap-16 lg:px-14 lg:py-16">
      <div className="flex flex-col">
        <span className="inline-flex w-fit items-center rounded-md border border-border bg-highlight px-3 py-1.5 text-xs font-medium text-highlight-foreground">
          {hero.badge}
        </span>
        <h1 className="mt-8 max-w-[650px] text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-[52px] lg:leading-[1.1]">
          {hero.title}
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
          {hero.subtitle}
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href={`/${locale}/jobs/new`}
            className={cn(
              buttonVariants({ size: 'lg' }),
              'h-11 rounded-md px-5',
            )}
          >
            {hero.postJob}
          </Link>
          <Link
            href={`/${locale}/trades`}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'lg' }),
              'h-11 rounded-md px-5',
            )}
          >
            {hero.browseTrades}
          </Link>
        </div>
        <dl className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-border bg-card p-5 shadow-card"
            >
              <dt className="sr-only">{stat.label}</dt>
              <dd>
                <span className="block text-3xl font-medium text-foreground">
                  {stat.value}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {stat.label}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="flex items-start lg:justify-end">
        <JobSearchPanel locale={locale} dict={dict} />
      </div>
    </section>
  );
}
