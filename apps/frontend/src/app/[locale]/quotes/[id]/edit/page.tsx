import { SiteHeader } from '@/components/layout/site-header';
import { EditQuoteForm } from '@/components/quotes/edit-quote-form';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';
import { requireUserType } from '@/lib/server-session';

export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  // Editing a quote is a tradesman action; ownership + status are re-checked in
  // the backend service (this is the UX guard).
  await requireUserType(locale, 'TRADESMAN');
  const dict = await getDictionary(locale);
  const tm = dict.myQuotes;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SiteHeader locale={locale} dict={dict} />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-2xl px-6 py-10 lg:px-14">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">
              {tm.editTitle}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {tm.editSubtitle}
            </p>
          </div>
          <EditQuoteForm locale={locale} dict={dict} quoteId={id} />
        </div>
      </main>
    </div>
  );
}
