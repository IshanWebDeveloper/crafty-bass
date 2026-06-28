import type { Metadata } from 'next';
import { PrivacyActions } from '@/components/account/privacy-actions';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';
import { requireAuth } from '@/lib/server-session';

export const metadata: Metadata = {
  title: 'Privacy — Crafty Bass',
  description: 'Manage your data exports and privacy settings.',
};

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  await requireAuth(locale);
  const t = (await getDictionary(locale)).privacy;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t.title}
        </h1>
        <p className="text-sm text-muted-foreground">{t.intro}</p>
      </header>
      <PrivacyActions />
    </main>
  );
}
