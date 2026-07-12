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
import { useMe } from '@/lib/hooks/use-me';
import { useMounted } from '@/lib/hooks/use-mounted';
import { useSessionStore, type UserType } from '@/lib/stores/session-store';
import { RoleBadge } from './role-badge';
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
  // The session carries `userType` (inferred on the auth client), so the badge
  // can render the instant the session resolves; the store is the optimistic
  // fallback (e.g. just after sign-up, before the session refreshes).
  const storeUserType = useSessionStore((s) => s.userType);
  const userType =
    (session?.user as { userType?: UserType } | undefined)?.userType ??
    storeUserType;
  // The tradesman's stated primary trade, badged beside the avatar.
  const { data: me } = useMe();
  const primaryTrade =
    userType === 'TRADESMAN' ? (me?.primaryTrade ?? null) : null;
  // Until mounted, the server (no session) and client (session may resolve
  // synchronously) would disagree; render the skeleton on both - see useMounted.
  const mounted = useMounted();
  const h = dict.header;

  if (!mounted || isPending) {
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
  // Prefer the presigned avatar from /users/me; the better-auth session only
  // carries the raw storage key, which isn't directly loadable.
  const avatarSrc = me?.image ?? user.image ?? undefined;
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
          'h-auto min-h-10 gap-2 rounded-full pl-1 pr-2.5 cursor-pointer',
        )}
      >
        <Avatar className="h-8 w-8">
          {avatarSrc ? <AvatarImage src={avatarSrc} alt={user.name} /> : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="hidden flex-col items-start md:flex">
          <span className="text-sm font-medium leading-tight">{user.name}</span>
          <RoleBadge
            userType={userType}
            primaryTrade={primaryTrade}
            dict={dict}
            className="mt-0.5"
          />
        </div>
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
            <RoleBadge
              userType={userType}
              primaryTrade={primaryTrade}
              dict={dict}
              className="mt-1.5"
            />
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
