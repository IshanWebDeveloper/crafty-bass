import Link from 'next/link';
import { Badge, Card, buttonVariants, cn } from '@repo/ui';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import type { JobStats } from '@/lib/api/jobs';
import type { CategoryTradesmanCount } from '@/lib/api/stats.server';
import { JobSearchPanel } from './job-search-panel';
import { HeroBackdrop } from './hero-backdrop';

export function HeroSection({
  locale,
  dict,
  stats: jobStats,
  counts,
}: {
  locale: Locale;
  dict: Dictionary;
  stats?: JobStats | null;
  counts: CategoryTradesmanCount[] | null;
}) {
  const hero = dict.hero;
  const fmt = (n: number) => new Intl.NumberFormat(locale).format(n);
  // Real marketplace counts when the backend is reachable; otherwise fall back
  // to the static marketing figures so the landing page still renders.
  const stats = jobStats
    ? [
        { value: fmt(jobStats.openJobs), label: hero.stats.openJobs },
        { value: fmt(jobStats.matchedJobs), label: hero.stats.matchedJobs },
        {
          value: fmt(jobStats.verifiedTradespeople),
          label: hero.stats.verifiedPros,
        },
      ]
    : [
        { value: '420+', label: hero.stats.activeTrades },
        { value: '2h', label: hero.stats.avgResponse },
        { value: '9.1k', label: hero.stats.verifiedReviews },
      ];

  return (
    <div className="relative isolate overflow-hidden">
      <HeroBackdrop />
      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-14 lg:py-16">
        <div className="flex flex-col">
          <Badge variant="highlight" className="w-fit">
            {hero.badge}
          </Badge>
          <h1 className="mt-8 max-w-[560px] text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-[52px] lg:leading-[1.1]">
            {hero.title}
          </h1>
          <p className="mt-6 max-w-[460px] text-lg leading-relaxed text-muted-foreground sm:text-xl">
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
              <Card key={stat.label} className="p-5 shadow-card">
                <dt className="sr-only">{stat.label}</dt>

                <dd>
                  <span className="block text-3xl font-medium text-foreground">
                    {stat.value}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {stat.label}
                  </span>
                </dd>
              </Card>
            ))}
          </dl>
        </div>
        <div className="flex items-start lg:justify-end">
          <JobSearchPanel locale={locale} dict={dict} counts={counts} />
        </div>
      </section>
    </div>
  );
}
