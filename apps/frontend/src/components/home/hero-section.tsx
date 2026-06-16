import Link from 'next/link';
import { buttonVariants, cn } from '@repo/ui';
import { JobSearchPanel } from './job-search-panel';

const stats = [
  { value: '420+', label: 'active trades' },
  { value: '2h', label: 'avg. response' },
  { value: '9.1k', label: 'verified reviews' },
];

export function HeroSection() {
  return (
    <section className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 py-12 lg:grid-cols-2 lg:gap-16 lg:px-14 lg:py-16">
      <div className="flex flex-col">
        <span className="inline-flex w-fit items-center rounded-md border border-border bg-highlight px-3 py-1.5 text-xs font-medium text-highlight-foreground">
          Verified local trades
        </span>
        <h1 className="mt-8 max-w-[650px] text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-[52px] lg:leading-[1.1]">
          Book trusted tradespeople without the quote chaos.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
          Post a job, compare transparent quotes, chat securely, and approve
          work with homeowner protections built in.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/jobs/new"
            className={cn(
              buttonVariants({ size: 'lg' }),
              'h-11 rounded-md px-5',
            )}
          >
            Post a job
          </Link>
          <Link
            href="/trades"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'lg' }),
              'h-11 rounded-md px-5',
            )}
          >
            Browse trades
          </Link>
        </div>
        <dl className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-border bg-card p-5 shadow-[0px_10px_30px_-14px_rgba(18,25,22,0.1)]"
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
        <JobSearchPanel />
      </div>
    </section>
  );
}
