import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui';
import { SignInForm } from '@/components/auth/sign-in-form';
import { getServerSession } from '@/lib/server-session';

export default async function AdminSignInPage() {
  // Keep already signed-in staff off the sign-in screen. Only bounce confirmed
  // console users (ADMIN/SUPPORT); anyone else stays here so they can sign out.
  const session = await getServerSession();
  const role = session?.user.role;
  if (role === 'ADMIN' || role === 'SUPPORT') {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Crafty Bass Admin</CardTitle>
          <CardDescription>
            Sign in with your admin or support email and password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* useSearchParams (for the post-login redirect) needs a Suspense
              boundary during prerender. */}
          <Suspense fallback={null}>
            <SignInForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
