import Link from 'next/link';
import { SiteHeader } from '@/components/layout/site-header';
import { SignInForm } from '@/components/auth/sign-in-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';

export default async function SignInPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  const t = dict.auth;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SiteHeader locale={locale} dict={dict} />
      <main className="flex-1">
        <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-16">
          <Card>
            <CardHeader>
              <CardTitle>{t.signIn.title}</CardTitle>
              <CardDescription>{t.signIn.subtitle}</CardDescription>
            </CardHeader>
            <CardContent>
              <SignInForm locale={locale} dict={dict} />
            </CardContent>
          </Card>
          <p className="text-center text-sm text-muted-foreground">
            {t.signIn.noAccount}{' '}
            <Link
              href={`/${locale}/sign-up`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {t.signIn.createAccount}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
