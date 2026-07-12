'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@repo/ui';
import { signOut } from '@/lib/auth-client';

// Shown to a user who is signed in but whose role is not ADMIN/SUPPORT. The
// server guard (requireAdmin) authenticates and resolves the role; this renders
// the deliberate access-denied notice rather than a dashboard full of 403s.
export function AccessDenied() {
  const router = useRouter();
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
