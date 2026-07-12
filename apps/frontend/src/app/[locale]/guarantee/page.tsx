import Link from 'next/link';
import {
  ShieldCheck,
  BadgeCheck,
  Lock,
  Wrench,
  Scale,
  Check,
  X,
} from 'lucide-react';
import { buttonVariants } from '@repo/ui';
import { SiteHeader } from '@/components/layout/site-header';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';

const PILLAR_ICONS = [BadgeCheck, Lock, Wrench, Scale] as const;

export default async function GuaranteePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  const t = dict.guarantee;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SiteHeader locale={locale} dict={dict} />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-6 py-12 lg:px-14">
          {/* Hero */}
          <div className="flex items-center gap-2 text-success">
            <ShieldCheck className="size-6" aria-hidden />
            <span className="text-sm font-semibold uppercase tracking-wide">
              {t.badge}
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            {t.title}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            {t.intro}
          </p>

          {/* Pillars */}
          <h2 className="mt-12 text-lg font-semibold tracking-tight">
            {t.pillarsTitle}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {t.pillars.map((pillar, i) => {
              const Icon = PILLAR_ICONS[i] ?? BadgeCheck;
              return (
                <div
                  key={pillar.heading}
                  className="rounded-xl border border-border bg-card p-5 shadow-soft"
                >
                  <span className="inline-flex size-9 items-center justify-center rounded-lg bg-accent-soft text-success">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-3 text-sm font-semibold text-foreground">
                    {pillar.heading}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {pillar.body}
                  </p>
                </div>
              );
            })}
          </div>

          {/* How it works */}
          <h2 className="mt-12 text-lg font-semibold tracking-tight">
            {t.howTitle}
          </h2>
          <ol className="mt-4 space-y-4">
            {t.how.map((item, i) => (
              <li key={item.step} className="flex gap-4">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-success text-sm font-semibold text-success-foreground">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {item.step}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {/* Covered / not covered */}
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <section>
              <h2 className="text-lg font-semibold tracking-tight">
                {t.coveredTitle}
              </h2>
              <ul className="mt-3 space-y-2.5">
                {t.covered.map((line) => (
                  <li key={line} className="flex gap-2.5 text-sm">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-success"
                      aria-hidden
                    />
                    <span className="leading-relaxed text-muted-foreground">
                      {line}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h2 className="text-lg font-semibold tracking-tight">
                {t.notCoveredTitle}
              </h2>
              <ul className="mt-3 space-y-2.5">
                {t.notCovered.map((line) => (
                  <li key={line} className="flex gap-2.5 text-sm">
                    <X
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <span className="leading-relaxed text-muted-foreground">
                      {line}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Limits + claim */}
          <div className="mt-12 space-y-8">
            <section>
              <h2 className="text-lg font-semibold tracking-tight">
                {t.limitsTitle}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t.limits}
              </p>
            </section>
            <section>
              <h2 className="text-lg font-semibold tracking-tight">
                {t.claimTitle}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t.claim}
              </p>
            </section>
          </div>

          {/* CTA */}
          <div className="mt-12 flex flex-wrap items-center gap-4 border-t border-border pt-8">
            <Link
              href={`/${locale}/jobs/new`}
              className={buttonVariants({ size: 'lg' })}
            >
              {t.cta}
            </Link>
            <Link
              href={`/${locale}`}
              className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
            >
              {t.backHome}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
