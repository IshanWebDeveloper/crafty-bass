'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input } from '@repo/ui';
import { authClient } from '@/lib/auth-client';

// Email + password sign-in for the admin console (emailAndPassword is enabled in
// packages/auth/src/index.ts). Role enforcement happens server-side after
// sign-in (lib/server-session.ts + the dashboard layout) — a non-admin who
// authenticates here is shown an access-denied screen rather than the dashboard.
export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { error: signInError } = await authClient.signIn.email({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError('Invalid email or password.');
        return;
      }
      // Bounce back to wherever the guard sent us from, defaulting to the root
      // dashboard. router.refresh() lets the server layout re-read the new
      // session.
      router.replace(params.get('from') ?? '/');
      router.refresh();
    } catch {
      setError('Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@craftybass.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Admin and support accounts only.
        </p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button
        type="submit"
        className="w-full"
        disabled={submitting || !email || !password}
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
