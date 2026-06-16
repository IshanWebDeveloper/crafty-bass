import Link from 'next/link';
import { buttonVariants, cn, ModeToggle } from '@repo/ui';

const navItems = [
  { label: 'Find trades', href: '/trades' },
  { label: 'Post a job', href: '/jobs/new' },
  { label: 'Quotes', href: '/quotes' },
  { label: 'Messages', href: '/messages' },
];

export function SiteHeader() {
  return (
    <header className="w-full">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-6 lg:px-14">
        <Link href="/" className="text-2xl font-medium tracking-tight">
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
          <ModeToggle />
          <Link
            href="/sign-in"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'lg' }),
              'h-10 rounded-md px-4',
            )}
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className={cn(
              buttonVariants({ size: 'lg' }),
              'h-10 rounded-md px-4',
            )}
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
