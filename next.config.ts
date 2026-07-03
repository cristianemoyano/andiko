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
  // No remotePatterns: the only <Image> consumer (product thumbnails, which point at
  // arbitrary external URLs from CSV/WooCommerce import or manual paste) renders `unoptimized`,
  // so the Next.js image optimizer never fetches these URLs server-side. Allowing a wildcard
  // host here would otherwise make `/_next/image?url=` an open SSRF proxy.
}

export default nextConfig
