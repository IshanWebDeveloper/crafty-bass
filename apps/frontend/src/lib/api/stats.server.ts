import type { JobStats } from './jobs';

// Reach the API directly (server-to-server); the browser's /api/* rewrite isn't
// available in a server component. Mirrors server-session.ts.
const apiOrigin = process.env.API_PROXY_TARGET ?? 'http://localhost:3005';

/**
 * Server-side fetch of the public landing-page counts. Deliberately resilient:
 * on any failure (backend unreachable, non-200) it returns null so the homepage
 * still renders with its static fallback instead of erroring.
 */
export async function getJobStatsServer(): Promise<JobStats | null> {
  try {
    const res = await fetch(`${apiOrigin}/api/v1/jobs/stats`, {
      // Light caching so the landing page isn't a per-request DB hit.
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as JobStats;
  } catch {
    return null;
  }
}

export type CategoryTradesmanCount = { slug: string; count: number };

/**
 * Server-side fetch of the live per-category available-tradesman counts for the
 * landing-page category cards. Resilient like getJobStatsServer: returns null on
 * any failure so the grid falls back to its static counts instead of erroring.
 */
export async function getCategoryCountsServer(): Promise<
  CategoryTradesmanCount[] | null
> {
  try {
    const res = await fetch(`${apiOrigin}/api/v1/categories/tradesmen-counts`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as CategoryTradesmanCount[];
  } catch {
    return null;
  }
}
