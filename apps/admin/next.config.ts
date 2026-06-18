import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  distDir: 'dist',
  transpilePackages: ['@repo/ui'],
};

export default nextConfig;
