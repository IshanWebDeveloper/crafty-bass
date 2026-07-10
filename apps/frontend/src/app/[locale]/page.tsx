import { SiteHeader } from '@/components/layout/site-header';
import { HeroSection } from '@/components/home/hero-section';
import { CategoryGrid } from '@/components/home/category-grid';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';
import { redirectIfAuthenticated } from '@/lib/server-session';

export default async function Home({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  // Signed-in users belong on their dashboard, not the marketing landing page.
  await redirectIfAuthenticated(locale);
  const dict = await getDictionary(locale);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SiteHeader locale={locale} dict={dict} />
      <main className="flex-1">
        <HeroSection locale={locale} dict={dict} />
        <CategoryGrid locale={locale} dict={dict} />
      </main>
    </div>
  );
}
