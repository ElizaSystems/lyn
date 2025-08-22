import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: {
    // Allow production builds to successfully complete even with ESLint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow production builds to successfully complete even with TypeScript errors
    ignoreBuildErrors: true,
  }
}

export default nextConfig
