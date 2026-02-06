import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // reactCompiler disabled for Docker builds due to babel plugin path resolution issues
  reactCompiler: process.env.NODE_ENV === 'development',
  async rewrites() {
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
