import type { NextConfig } from 'next';

// The backend (NestJS + better-auth) origin. The browser never talks to it
// directly — see the rewrite below. Server-side code (e.g. server-session.ts)
// uses this same value to reach the API.
const apiOrigin = process.env.API_PROXY_TARGET ?? 'http://localhost:3005';

const nextConfig: NextConfig = {
  distDir: 'dist',
  transpilePackages: ['@repo/ui'],

  // Same-origin proxy: the browser only ever talks to the Next origin, and Next
  // forwards /api/* to the NestJS API. This makes the better-auth session cookie
  // first-party to the frontend origin, which is what lets server components read
  // it (see lib/server-session.ts) and sidesteps CORS for data fetches.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
