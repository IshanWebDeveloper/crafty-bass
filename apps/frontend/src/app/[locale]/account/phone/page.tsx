import { SiteHeader } from '@/components/layout/site-header';
import { SetPhoneView } from '@/components/account/set-phone-view';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';
import { requireAuth } from '@/lib/server-session';

export default async function AccountPhonePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ recovered?: string }>;
}) {
  const { locale } = await params;
  await requireAuth(locale);
  const { recovered } = await searchParams;
  const dict = await getDictionary(locale);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SiteHeader locale={locale} dict={dict} />
      <main className="flex-1">
        <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-16">
          <SetPhoneView
            locale={locale}
            dict={dict}
            recovered={recovered === '1'}
          />
        </div>
      </main>
    </div>
  );
}
