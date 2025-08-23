import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: {
    // Allow production builds to successfully complete even with ESLint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow production builds to successfully complete even with TypeScript errors
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    // Provide polyfills for node modules in browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer'),
        process: require.resolve('process/browser'),
      }
      
      // Add ProvidePlugin to inject globals
      const webpack = require('webpack')
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser',
        })
      )
    }
    
    return config
  }
}

export default nextConfig
