'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@repo/ui';
import { useMe } from '@/lib/hooks/use-me';
import { useMounted } from '@/lib/hooks/use-mounted';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

/**
 * Role-aware primary navigation. Signed-out visitors see a light marketing nav
 * (browse trades only — posting a job requires an account, so it isn't offered
 * here); homeowners and tradesmen each get the nav the design specifies for
 * their role (homeowners also get a "Post a job" CTA — see {@link HeaderActions}).
 */
export function MainNav({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const pathname = usePathname();
  const { data: me } = useMe();
  // The session resolves only on the client; render the guest nav until mounted
  // so SSR and the first client paint agree (avoids a hydration mismatch).
  const mounted = useMounted();
  const h = dict.header;
  const base = `/${locale}`;

  const guest = [{ label: h.findTrades, href: `${base}/trades` }];
  const homeowner = [
    { label: h.findTrades, href: `${base}/trades` },
    { label: h.myJobs, href: `${base}/jobs/mine` },
    { label: h.messages, href: `${base}/messages` },
  ];
  const tradesman = [
    { label: h.browseJobs, href: `${base}/jobs` },
    { label: h.quotes, href: `${base}/quotes` },
    { label: h.messages, href: `${base}/messages` },
  ];

  const items =
    mounted && me?.userType === 'TRADESMAN'
      ? tradesman
      : mounted && me?.userType === 'HOMEOWNER'
        ? homeowner
        : guest;

  return (
    <nav className="hidden items-center gap-10 md:flex">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'text-sm font-medium transition-colors',
              active
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
