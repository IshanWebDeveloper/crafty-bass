import type { Metadata } from 'next';
import { PrivacyActions } from '@/components/account/privacy-actions';

export const metadata: Metadata = {
  title: 'Privacy — Crafty Bass',
  description: 'Manage your data exports and privacy settings.',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Privacy &amp; data exports
        </h1>
        <p className="text-sm text-muted-foreground">
          Request a copy of the data we hold about you under GDPR. Exports are
          retained for 24 hours and then deleted automatically.
        </p>
      </header>
      <PrivacyActions />
    </main>
  );
}
