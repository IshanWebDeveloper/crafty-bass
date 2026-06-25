import { Suspense } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui';
import { SignInForm } from '@/components/auth/sign-in-form';

export default function AdminSignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Crafty Bass Admin</CardTitle>
          <CardDescription>
            Sign in with your admin or support mobile number.
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
