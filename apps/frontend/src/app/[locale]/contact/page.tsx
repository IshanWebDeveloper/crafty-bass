import Link from 'next/link';
import { Mail, Clock } from 'lucide-react';
import { SiteHeader } from '@/components/layout/site-header';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  const t = dict.contact;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SiteHeader locale={locale} dict={dict} />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-6 py-12 lg:px-14">
          <h1 className="text-3xl font-semibold tracking-tight">{t.title}</h1>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            {t.intro}
          </p>

          <div className="mt-10 space-y-6">
            <section className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <Mail className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {t.emailHeading}
                </h2>
                <a
                  href={`mailto:${t.email}`}
                  className="mt-0.5 inline-block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {t.email}
                </a>
              </div>
            </section>

            <section className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Clock className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {t.supportHeading}
                </h2>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                  {t.support}
                </p>
              </div>
            </section>
          </div>

          <div className="mt-12 border-t border-border pt-6">
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
