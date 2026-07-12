import type { NextConfig } from 'next';

// Same-origin proxy: the admin browser only ever talks to its own origin
// (3001); this rewrite forwards /api/* to the backend server-side. That keeps
// the better-auth session cookie first-party to the admin origin (so server
// components can read it) and removes CORS from data fetches. Matches
// apps/frontend/next.config.ts.
const apiOrigin = process.env.API_PROXY_TARGET ?? 'http://localhost:3005';

const nextConfig: NextConfig = {
  distDir: 'dist',
  transpilePackages: ['@repo/ui'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;
