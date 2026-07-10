import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import type { Locale } from '@/i18n/config';

interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
  role?: string;
  userType?: string;
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
 * the frontend and therefore visible here. No DB import in the frontend.
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

/**
 * Guards a private page/layout: bounces unauthenticated visitors to the
 * locale-aware sign-in page instead of letting client views hang on skeletons.
 * Real data protection still lives in the backend PermissionsGuard; this is the
 * UX redirect. Call at the top of a server component, right after resolving the
 * locale.
 */
export async function requireAuth(locale: Locale): Promise<SessionResponse> {
  const session = await getServerSession();
  if (!session) redirect(`/${locale}/sign-in`);
  return session;
}

/**
 * Inverse of {@link requireAuth}: keeps already-signed-in users off the
 * auth pages (sign-in, sign-up, account-recovery) by bouncing them to their
 * dashboard. Call at the top of those server pages.
 */
export async function redirectIfAuthenticated(locale: Locale): Promise<void> {
  const session = await getServerSession();
  if (session) redirect(`/${locale}/dashboard`);
}

export type AppUserType = 'HOMEOWNER' | 'TRADESMAN';

/**
 * The page each confirmed user type calls home. Used as the redirect target
 * when a user wanders into the other role's area. Homeowners manage their
 * posted jobs; tradesmen live on the open-jobs board.
 */
export function roleHome(locale: Locale, userType: AppUserType): string {
  return userType === 'TRADESMAN' ? `/${locale}/jobs` : `/${locale}/jobs/mine`;
}

/**
 * Guards a role-specific page. Like {@link requireAuth} it bounces signed-out
 * visitors to sign-in, but additionally redirects a user whose *confirmed*
 * userType is the opposite of `allowed` to their own role's home.
 *
 * A `null` userType (a fresh account that hasn't posted a job or quoted yet) is
 * allowed through: the backend assigns userType lazily on the first job/quote,
 * so the matching page is exactly where that assignment happens — gating it out
 * would dead-end onboarding. As always this is UX only; real authorization
 * stays in the backend service layer (ownership + userType checks).
 */
export async function requireUserType(
  locale: Locale,
  allowed: AppUserType,
): Promise<SessionResponse> {
  const session = await getServerSession();
  if (!session) redirect(`/${locale}/sign-in`);
  const userType = session.user.userType as AppUserType | null | undefined;
  if (userType && userType !== allowed) {
    redirect(roleHome(locale, userType));
  }
  return session;
}

/**
 * Keeps signed-in users of a given userType out of an otherwise-public page,
 * bouncing them to their role home. Unlike {@link requireUserType} this does
 * NOT require a session — anonymous visitors pass straight through — so it fits
 * pages that stay public for discovery (e.g. the trades directory, which the
 * landing page links anonymous visitors into) but must not be shown to one
 * role. Here it stops a signed-in tradesman from browsing other tradesmen while
 * leaving homeowners and logged-out visitors untouched. UX only; the backend
 * still enforces what data each caller can read.
 */
export async function redirectUserType(
  locale: Locale,
  blocked: AppUserType,
): Promise<void> {
  const session = await getServerSession();
  const userType = session?.user.userType as AppUserType | null | undefined;
  if (userType === blocked) {
    redirect(roleHome(locale, userType));
  }
}
