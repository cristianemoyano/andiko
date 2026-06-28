import type { NextConfig } from 'next'
import { resolveAppVersion } from './resolve-app-version'

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: resolveAppVersion(),
  },
  output: 'standalone',
  // sequelize + umzug are not in Next's default external list; pg/pino are auto-externalized.
  serverExternalPackages: ['sequelize', 'pg-hstore', 'umzug', '@ramiidv/arca-facturacion', 'qrcode'],
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
