'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { buttonVariants, cn } from '@repo/ui';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { useMe } from '@/lib/hooks/use-me';
import { useMounted } from '@/lib/hooks/use-mounted';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

/**
 * Right-cluster header actions that depend on who's signed in: the notification
 * bell (signed-in only) and the homeowner "Post a job" CTA. The avatar / auth
 * menu is rendered separately by {@link HeaderAuth}.
 */
export function HeaderActions({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const { data: me } = useMe();
  // Gate session-dependent actions until mounted so SSR (no session) and the
  // first client paint render the same thing — see {@link useMounted}.
  const mounted = useMounted();

  return (
    <>
      {mounted && me ? <NotificationBell locale={locale} dict={dict} /> : null}
      {mounted && me?.userType === 'HOMEOWNER' ? (
        <Link
          href={`/${locale}/jobs/new`}
          className={cn(
            buttonVariants({ size: 'sm' }),
            'hidden h-9 gap-1.5 rounded-md px-3.5 sm:inline-flex',
          )}
        >
          <Plus className="size-4" aria-hidden />
          {dict.header.postJob}
        </Link>
      ) : null}
    </>
  );
}
