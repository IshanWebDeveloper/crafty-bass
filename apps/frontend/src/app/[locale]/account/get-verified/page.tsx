import { SiteHeader } from '@/components/layout/site-header';
import { OnboardingWizard } from '@/components/verification/onboarding-wizard';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';
import { requireAuth } from '@/lib/server-session';

export default async function GetVerifiedPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  await requireAuth(locale);
  const dict = await getDictionary(locale);
  const t = dict.verification;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SiteHeader locale={locale} dict={dict} />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-6 py-10 lg:px-14">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">{t.title}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
          <OnboardingWizard locale={locale} dict={dict} />
        </div>
      </main>
    </div>
  );
}
