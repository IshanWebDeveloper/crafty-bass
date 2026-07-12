'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Phone } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useSession } from '@/lib/auth-client';
import { ChangePhoneNumberForm } from '@/components/profile/change-phone-number-form';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

/**
 * Dedicated "set a new mobile number" step. The account-recovery flow redirects
 * here after the user signs back in by email (`?recovered=1`), so replacing the
 * lost number is a focused step rather than something to hunt for on the profile
 * page. Reachable on its own too as a plain phone-management screen.
 */
export function SetPhoneView({
  locale,
  dict,
  recovered,
}: {
  locale: Locale;
  dict: Dictionary;
  recovered: boolean;
}) {
  const router = useRouter();
  const t = dict.profile.phone;
  const { data: session } = useSession();
  const current =
    (session?.user as { phoneNumber?: string })?.phoneNumber ?? '';

  const done = () => {
    router.push(`/${locale}/dashboard`);
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="size-5 text-muted-foreground" aria-hidden />
          {recovered ? t.recoveredTitle : t.manageTitle}
        </CardTitle>
        <CardDescription>
          {recovered ? t.recoveredSubtitle : t.manageSubtitle}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {current ? (
          <div className="rounded-lg bg-muted px-4 py-3 text-sm">
            <span className="text-muted-foreground">{t.currentLabel}: </span>
            <span className="font-mono">{current}</span>
          </div>
        ) : null}
        <ChangePhoneNumberForm
          dict={dict}
          submitLabel={t.save}
          onSuccess={done}
        />
        <p className="text-center text-sm">
          <Link
            href={`/${locale}/dashboard`}
            className="text-muted-foreground underline-offset-4 hover:underline"
          >
            {t.skip}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
