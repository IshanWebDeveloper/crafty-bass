import { createAuthClient } from 'better-auth/react';

// Points at the admin app's own origin: auth now flows through the same-origin
// /api/* rewrite (next.config.ts), so the better-auth session cookie is
// first-party to the admin origin. Empty string on the server for relative
// resolution; window.location.origin in the browser. Mirrors
// apps/frontend/src/lib/auth-client.ts. Admins sign in with email + password
// (emailAndPassword is enabled in packages/auth/src/index.ts); signIn.email is
// core better-auth, so no client plugin is needed.
export const authClient = createAuthClient({
  baseURL: typeof window === 'undefined' ? '' : window.location.origin,
});

export const { signIn, signOut, useSession, getSession } = authClient;
