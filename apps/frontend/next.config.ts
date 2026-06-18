import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  distDir: 'dist',
  transpilePackages: ['@repo/ui'],
};

export default nextConfig;
