import { SiteHeader } from '@/components/layout/site-header';
import { TradesmanPublicView } from '@/components/trades/tradesman-public-view';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';
import { redirectUserType } from '@/lib/server-session';

export default async function TradesmanProfilePage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  // Tradesmen must not view other tradesmen's profiles (see /trades guard).
  await redirectUserType(locale, 'TRADESMAN');
  const dict = await getDictionary(locale);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SiteHeader locale={locale} dict={dict} />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-6 py-10 lg:px-14">
          <TradesmanPublicView locale={locale} dict={dict} userId={id} />
        </div>
      </main>
    </div>
  );
}
