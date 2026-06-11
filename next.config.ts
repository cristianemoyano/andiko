import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // sequelize + umzug are not in Next's default external list; pg/pino are auto-externalized.
  serverExternalPackages: ['sequelize', 'pg-hstore', 'umzug'],
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
