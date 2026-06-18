import Link from 'next/link';
import { buttonVariants, cn, ModeToggle } from '@repo/ui';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { LocaleSwitcher } from './locale-switcher';

export function SiteHeader({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const h = dict.header;
  const navItems = [
    { label: h.findTrades, href: `/${locale}/trades` },
    { label: h.postJob, href: `/${locale}/jobs/new` },
    { label: h.quotes, href: `/${locale}/quotes` },
    { label: h.messages, href: `/${locale}/messages` },
  ];

  return (
    <header className="w-full">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-6 lg:px-14">
        <Link
          href={`/${locale}`}
          className="text-2xl font-medium tracking-tight"
        >
          Crafty Bass
        </Link>
        <nav className="hidden items-center gap-10 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <LocaleSwitcher locale={locale} />
          <ModeToggle />
          <Link
            href={`/${locale}/sign-in`}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'lg' }),
              'h-10 rounded-md px-4',
            )}
          >
            {h.signIn}
          </Link>
          <Link
            href={`/${locale}/sign-up`}
            className={cn(
              buttonVariants({ size: 'lg' }),
              'h-10 rounded-md px-4',
            )}
          >
            {h.getStarted}
          </Link>
        </div>
      </div>
    </header>
  );
}
