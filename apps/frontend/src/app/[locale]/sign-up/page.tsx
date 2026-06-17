import Link from 'next/link';
import { SiteHeader } from '@/components/layout/site-header';
import { SignUpForm } from '@/components/auth/sign-up-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';

export default async function SignUpPage({
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
              <CardTitle>{t.signUp.title}</CardTitle>
              <CardDescription>{t.signUp.subtitle}</CardDescription>
            </CardHeader>
            <CardContent>
              <SignUpForm locale={locale} dict={dict} />
            </CardContent>
          </Card>
          <p className="text-center text-sm text-muted-foreground">
            {t.signUp.haveAccount}{' '}
            <Link
              href={`/${locale}/sign-in`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {t.signUp.signInLink}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
