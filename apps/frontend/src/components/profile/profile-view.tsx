'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Skeleton } from '@repo/ui';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getMyProfile } from '@/lib/api/profiles';
import { HomeownerProfileForm } from './homeowner-profile-form';
import { TradesmanProfileForm } from './tradesman-profile-form';
import type { Dictionary } from '@/i18n/dictionaries';

export function ProfileView({ dict }: { dict: Dictionary }) {
  const t = dict.profile;
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: getMyProfile,
  });
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {role === 'HOMEOWNER' ? t.homeowner.heading : t.tradesman.heading}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {role === 'HOMEOWNER' ? (
          <HomeownerProfileForm
            initial={profile.homeownerProfile}
            dict={dict}
          />
        ) : (
          <TradesmanProfileForm
            initial={profile.tradesmanProfile}
            dict={dict}
          />
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
