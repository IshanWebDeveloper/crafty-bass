import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import type { Role } from './api/users';

interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
  // `role` is a better-auth additionalField (packages/auth/src/index.ts), so it
  // rides in the get-session payload — no separate /users/me call needed.
  role?: Role;
}

export interface SessionResponse {
  user: SessionUser;
  session: {
    id: string;
    expiresAt: string;
  };
}

// Reach the API directly (server-to-server). The browser uses the same-origin
// /api/* rewrite from next.config.ts, but on the server there is no proxy hop.
const apiOrigin = process.env.API_PROXY_TARGET ?? 'http://localhost:3005';

/**
 * Reads the current session by calling the backend's /api/auth/get-session,
 * forwarding the incoming request's cookies. Because auth is now same-origin
 * (next.config.ts rewrite), the better-auth session cookie is first-party to
 * the admin app and therefore visible here.
 */
export async function getServerSession(): Promise<SessionResponse | null> {
  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader) return null;

  const res = await fetch(`${apiOrigin}/api/auth/get-session`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const json = (await res.json()) as SessionResponse | null;
  return json && json.user ? json : null;
}

export interface AdminAccess {
  session: SessionResponse;
  role: Role | null;
  authorized: boolean;
}

/**
 * Server-side equivalent of the old client AuthGuard. Bounces signed-out
 * visitors to /sign-in before any client render, then reads the caller's role
 * from the session (a better-auth additionalField) and reports whether they may
 * use the console (ADMIN or SUPPORT only).
 *
 * The wrong-role case is intentionally NOT redirected here: it returns
 * `authorized: false` so the layout can render the access-denied notice (a
 * signed-in but unauthorized user), matching the previous UX. Real
 * authorization still lives in the backend PermissionsGuard; this is UX only.
 */
export async function requireAdmin(): Promise<AdminAccess> {
  const session = await getServerSession();
  if (!session) redirect('/sign-in');

  const role = session.user.role ?? null;

  return {
    session,
    role,
    authorized: role === 'ADMIN' || role === 'SUPPORT',
  };
}
