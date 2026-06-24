'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  ShieldCheck,
  User,
} from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  buttonVariants,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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
        className={cn(
          buttonVariants({ variant: 'ghost' }),
          'h-10 gap-2 rounded-full pl-1 pr-2.5',
        )}
      >
        <Avatar className="h-8 w-8">
          {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <span className="hidden text-sm font-medium md:inline">
          {user.name}
        </span>
        <ChevronDown
          className="size-4 text-muted-foreground transition-transform group-aria-expanded/button:rotate-180"
          aria-hidden
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">
              {user.name}
            </span>
            <span className="truncate text-xs font-normal text-muted-foreground">
              {user.email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={`/${locale}/dashboard`} />}>
          <LayoutDashboard />
          {h.dashboard}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={`/${locale}/messages`} />}>
          <MessageSquare />
          {h.messages}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={`/${locale}/account/profile`} />}>
          <User />
          {h.profile}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={`/${locale}/account/privacy`} />}>
          <ShieldCheck />
          {h.privacy}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => void handleSignOut()}
        >
          <LogOut />
          {h.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
