import { SiteHeader } from '@/components/layout/site-header';
import { FundDepositView } from '@/components/escrow/fund-deposit-view';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';
import { requireUserType } from '@/lib/server-session';

export default async function FundDepositPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  await requireUserType(locale, 'HOMEOWNER');
  const dict = await getDictionary(locale);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SiteHeader locale={locale} dict={dict} />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-14">
          <FundDepositView locale={locale} dict={dict} jobId={id} />
        </div>
      </main>
    </div>
  );
}
