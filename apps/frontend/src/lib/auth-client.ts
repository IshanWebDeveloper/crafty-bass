import { createAuthClient } from 'better-auth/react';

// Points at the backend better-auth mount (origin + /api/auth, applied by the
// client). Defaults to the local backend; override with NEXT_PUBLIC_BETTER_AUTH_URL.
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? 'http://localhost:3005',
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
