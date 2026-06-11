import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['sequelize', 'pg', 'pg-hstore', 'pg-native', 'pino', 'pino-pretty', 'umzug'],
  // Include migration files in the serverless output so the /api/admin/migrate route can glob them at runtime.
  outputFileTracingIncludes: {
    '/api/admin/migrate': ['./src/db/migrations/**/*'],
  },
  images: {
    remotePatterns: [
      // Allow external product image URLs (CSV/import/manual paste).
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
}

export default nextConfig
