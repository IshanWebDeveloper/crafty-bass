import { SiteHeader } from '@/components/layout/site-header';
import { RecoverAccountForm } from '@/components/auth/recover-account-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';
import { redirectIfAuthenticated } from '@/lib/server-session';

export default async function AccountRecoveryPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  await redirectIfAuthenticated(locale);
  const dict = await getDictionary(locale);
  const tr = dict.auth.recovery;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SiteHeader locale={locale} dict={dict} />
      <main className="flex-1">
        <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-16">
          <Card>
            <CardHeader>
              <CardTitle>{tr.title}</CardTitle>
              <CardDescription>{tr.subtitle}</CardDescription>
            </CardHeader>
            <CardContent>
              <RecoverAccountForm locale={locale} dict={dict} />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
