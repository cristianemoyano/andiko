import type { NextConfig } from 'next'

// serverExternalPackages excludes pg from the bundle — trace real hoisted files
// into each lambda (node-linker=hoisted in .npmrc avoids pnpm symlink rejection).
const pgTraceIncludes = [
  './node_modules/pg/**',
  './node_modules/pg-hstore/**',
  './node_modules/pg-pool/**',
  './node_modules/pg-protocol/**',
  './node_modules/pg-types/**',
  './node_modules/pg-connection-string/**',
  './node_modules/pgpass/**',
  './node_modules/pg-int8/**',
  './node_modules/postgres-array/**',
  './node_modules/postgres-bytea/**',
  './node_modules/postgres-date/**',
  './node_modules/postgres-interval/**',
]

const nextConfig: NextConfig = {
  serverExternalPackages: ['sequelize', 'pg', 'pg-hstore', 'pg-native', 'pino', 'pino-pretty', 'umzug'],
  outputFileTracingIncludes: {
    '/api/admin/migrate': ['./src/db/migrations/**/*'],
    '/*': pgTraceIncludes,
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
