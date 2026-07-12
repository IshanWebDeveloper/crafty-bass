import Link from 'next/link';
import { ModeToggle } from '@repo/ui';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { LocaleSwitcher } from './locale-switcher';
import { HeaderAuth } from './header-auth';
import { MainNav } from './main-nav';
import { HeaderActions } from './header-actions';
import { Logo } from '@/components/brand/logo';

export function SiteHeader({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  return (
    <header className="w-full">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-6 lg:px-14">
        <Link
          href={`/${locale}`}
          className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Crafty Bass - home"
        >
          <Logo />
        </Link>
        <MainNav locale={locale} dict={dict} />
        <div className="flex items-center gap-3">
          <LocaleSwitcher locale={locale} />
          <ModeToggle />
          <HeaderActions locale={locale} dict={dict} />
          <HeaderAuth locale={locale} dict={dict} />
        </div>
      </div>
    </header>
  );
}
