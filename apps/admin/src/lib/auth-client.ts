import { createAuthClient } from 'better-auth/react';
import { phoneNumberClient } from 'better-auth/client/plugins';

// Points at the backend better-auth mount (origin + /api/auth, applied by the
// client). Phone OTP is the marketplace's primary credential — admins and
// support users sign in the same way (see packages/auth/src/index.ts). Defaults
// to the local backend; override with NEXT_PUBLIC_BETTER_AUTH_URL.
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? 'http://localhost:3005',
  plugins: [phoneNumberClient()],
});

export const { signIn, signOut, useSession, getSession } = authClient;
