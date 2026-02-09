import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // reactCompiler disabled for Docker builds due to babel plugin path resolution issues
  reactCompiler: process.env.NODE_ENV === 'development',
};

export default nextConfig;
