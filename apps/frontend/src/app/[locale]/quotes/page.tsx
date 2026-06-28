import { SiteHeader } from '@/components/layout/site-header';
import { MyQuotesList } from '@/components/quotes/my-quotes-list';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';
import { requireUserType } from '@/lib/server-session';

export default async function MyQuotesPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  await requireUserType(locale, 'TRADESMAN');
  const dict = await getDictionary(locale);
  const t = dict.myQuotes;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SiteHeader locale={locale} dict={dict} />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-6 py-10 lg:px-14">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">{t.title}</h1>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
          <MyQuotesList locale={locale} dict={dict} />
        </div>
      </main>
    </div>
  );
}
