import { SiteHeader } from '@/components/layout/site-header';
import { DashboardView } from '@/components/dashboard/dashboard-view';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  const t = dict.dashboard;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SiteHeader locale={locale} dict={dict} />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-14">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">{t.title}</h1>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
          <DashboardView locale={locale} dict={dict} />
        </div>
      </main>
    </div>
  );
}
