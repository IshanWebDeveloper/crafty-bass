'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  buttonVariants,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton,
} from '@repo/ui';
import { signOut, useSession } from '@/lib/auth-client';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

export function HeaderAuth({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const h = dict.header;

  if (isPending) {
    return <Skeleton className="h-10 w-32 rounded-md" />;
  }

  if (!session) {
    return (
      <div className="flex items-center gap-3">
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
          className={cn(buttonVariants({ size: 'lg' }), 'h-10 rounded-md px-4')}
        >
          {h.getStarted}
        </Link>
      </div>
    );
  }

  const user = session.user;
  const initials =
    user.name
      ?.split(' ')
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() ?? '?';

  async function handleSignOut() {
    await signOut();
    router.push(`/${locale}`);
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-10 gap-2 rounded-full pl-1 pr-3"
          />
        }
      >
        <Avatar className="h-8 w-8">
          {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <span className="hidden text-sm font-medium md:inline">
          {user.name}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="text-sm font-medium">{user.name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={`/${locale}/dashboard`} />}>
          {h.dashboard}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={`/${locale}/account/profile`} />}>
          {h.profile}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={`/${locale}/account/privacy`} />}>
          {h.privacy}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void handleSignOut()}>
          {h.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
