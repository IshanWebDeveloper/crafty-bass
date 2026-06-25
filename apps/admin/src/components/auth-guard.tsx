'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button, Skeleton } from '@repo/ui';
import { useSession, signOut } from '@/lib/auth-client';
import { useMe } from '@/lib/hooks/use-me';

// Gates the admin console: a valid session is required, and the user's role
// must be ADMIN or SUPPORT (the only roles the backend's admin/moderation
// endpoints accept). Authentication is the session; authorization is the role
// from /users/me. Anyone else is signed out and shown an access-denied notice
// rather than a broken dashboard full of 403s.
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending: sessionPending } = useSession();
  const me = useMe();

  const signedOut = !sessionPending && !session;

  useEffect(() => {
    if (signedOut) {
      const from = encodeURIComponent(pathname);
      router.replace(`/sign-in?from=${from}`);
    }
  }, [signedOut, pathname, router]);

  // Resolving the session, or redirecting an unauthenticated visitor.
  if (sessionPending || signedOut) {
    return <FullScreenLoading />;
  }

  // Session exists — wait on the role before deciding.
  if (me.isPending) {
    return <FullScreenLoading />;
  }

  const role = me.data?.role;
  const authorized = role === 'ADMIN' || role === 'SUPPORT';

  if (!authorized) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Access denied</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            This console is for admin and support staff only. Your account
            doesn&apos;t have the required role.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            void signOut().then(() => router.replace('/sign-in'));
          }}
        >
          Sign out
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}

function FullScreenLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Skeleton className="h-10 w-48 rounded-md" />
    </div>
  );
}
