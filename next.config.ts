import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['sequelize', 'pg', 'pg-hstore', 'pg-native', 'pino', 'pino-pretty'],
  images: {
    remotePatterns: [
      // Allow external product image URLs (CSV/import/manual paste).
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
}

export default nextConfig
