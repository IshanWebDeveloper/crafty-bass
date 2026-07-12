import { createAuthClient } from 'better-auth/react';
import {
  phoneNumberClient,
  emailOTPClient,
  inferAdditionalFields,
} from 'better-auth/client/plugins';

// Same-origin: next.config.ts rewrites /api/* to the NestJS API, so the client
// hits the frontend's own origin and the better-auth session cookie is set
// first-party. This is what lets server components read the session
// (lib/server-session.ts) and sidesteps CORS entirely. On the server (no
// `window`) an empty baseURL resolves relative paths against the request.
export const authClient = createAuthClient({
  baseURL: typeof window === 'undefined' ? '' : window.location.origin,
  // Mirror the server's custom `userType` field (packages/auth) so the client
  // types updateUser()/useSession() with it — without importing server code.
  plugins: [
    phoneNumberClient(),
    emailOTPClient(),
    inferAdditionalFields({ user: { userType: { type: 'string' } } }),
  ],
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
