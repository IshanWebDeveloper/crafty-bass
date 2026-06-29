'use client';

import { useState } from 'react';
import { Phone } from 'lucide-react';
import { Button } from '@repo/ui';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useSession } from '@/lib/auth-client';
import { ChangePhoneNumberForm } from './change-phone-number-form';
import type { Dictionary } from '@/i18n/dictionaries';

/**
 * Profile card for the everyday "change my sign-in number" case. The dedicated
 * post-recovery step (/account/phone) reuses the same {@link ChangePhoneNumberForm}.
 */
export function PhoneNumberCard({ dict }: { dict: Dictionary }) {
  const t = dict.profile.phone;
  const { data: session } = useSession();
  const current =
    (session?.user as { phoneNumber?: string })?.phoneNumber ?? '';
  const [editing, setEditing] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="size-4 text-muted-foreground" aria-hidden />
          {t.title}
        </CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {editing ? (
          <ChangePhoneNumberForm
            dict={dict}
            onSuccess={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-sm">{current || t.none}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
            >
              {t.change}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
