'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { Badge, Button, Skeleton, Tag, VerifiedBadge, cn } from '@repo/ui';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getMyProfile } from '@/lib/api/profiles';
import { useMe } from '@/lib/hooks/use-me';
import { HomeownerProfileForm } from './homeowner-profile-form';
import { TradesmanProfileForm } from './tradesman-profile-form';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

export function ProfileView({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.profile;
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: getMyProfile,
  });
  const { data: me } = useMe();
  const [chosenRole, setChosenRole] = useState<
    'HOMEOWNER' | 'TRADESMAN' | null
  >(null);

  if (isLoading || !profile) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  const role = profile.userType ?? chosenRole;

  if (!role) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.chooseRole.heading}</CardTitle>
          <CardDescription>{t.chooseRole.subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <RoleOption
            title={t.chooseRole.homeowner}
            copy={t.chooseRole.homeownerCopy}
            cta={t.chooseRole.continue}
            onChoose={() => setChosenRole('HOMEOWNER')}
          />
          <RoleOption
            title={t.chooseRole.tradesman}
            copy={t.chooseRole.tradesmanCopy}
            cta={t.chooseRole.continue}
            onChoose={() => setChosenRole('TRADESMAN')}
          />
        </CardContent>
      </Card>
    );
  }

  if (role === 'HOMEOWNER') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.homeowner.heading}</CardTitle>
        </CardHeader>
        <CardContent>
          <HomeownerProfileForm
            initial={profile.homeownerProfile}
            dict={dict}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <VerificationCard
        verified={profile.tradesmanProfile?.isVerified ?? false}
        locale={locale}
        dict={dict}
      />
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{t.tradesman.heading}</CardTitle>
            {me?.primaryTrade ? (
              <Tag variant="active">{me.primaryTrade}</Tag>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <TradesmanProfileForm
            initial={profile.tradesmanProfile}
            dict={dict}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function VerificationCard({
  verified,
  locale,
  dict,
}: {
  verified: boolean;
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.profile.verification;
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <span
          className={cn(
            'inline-flex size-10 shrink-0 items-center justify-center rounded-full',
            verified
              ? 'bg-success-subtle text-success'
              : 'bg-warning-subtle text-warning-foreground',
          )}
        >
          {verified ? (
            <ShieldCheck className="size-5" aria-hidden />
          ) : (
            <ShieldAlert className="size-5" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-base font-semibold">
            {verified ? (
              <>
                {t.verifiedTitle}
                <VerifiedBadge size={16} />
              </>
            ) : (
              t.unverifiedTitle
            )}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {verified ? t.verifiedBody : t.unverifiedBody}
          </p>
        </div>
        {verified ? (
          <Badge variant="success" className="shrink-0">
            {t.verifiedBadge}
          </Badge>
        ) : (
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href={`/${locale}/account/get-verified`} />}
          >
            {t.continue}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function RoleOption({
  title,
  copy,
  cta,
  onChoose,
}: {
  title: string;
  copy: string;
  cta: string;
  onChoose: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{copy}</p>
      </div>
      <Button variant="outline" onClick={onChoose}>
        {cta}
      </Button>
    </div>
  );
}
