import Link from 'next/link';
import { SiteHeader } from '@/components/layout/site-header';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  const t = dict.about;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SiteHeader locale={locale} dict={dict} />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-6 py-12 lg:px-14">
          <h1 className="text-3xl font-semibold tracking-tight">{t.title}</h1>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            {t.intro}
          </p>

          <div className="mt-10 space-y-8">
            {t.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-lg font-semibold tracking-tight">
                  {section.heading}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {section.body}
                </p>
              </section>
            ))}
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
