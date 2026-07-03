import type { NextConfig } from 'next'

import { posthogAssetsHost, POSTHOG_HOST } from '@/lib/posthog-config'
import { resolveAppVersion } from './resolve-app-version'

const posthogIngestHost = POSTHOG_HOST
const posthogStaticHost = posthogAssetsHost(posthogIngestHost)

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: resolveAppVersion(),
  },
  output: 'standalone',
  // sequelize + umzug are not in Next's default external list; pg/pino are auto-externalized.
  serverExternalPackages: [
    'sequelize',
    'pg-hstore',
    'umzug',
    '@ramiidv/arca-facturacion',
    'qrcode',
    'posthog-node',
    '@opentelemetry/sdk-logs',
    '@opentelemetry/exporter-logs-otlp-http',
    '@opentelemetry/resources',
    '@opentelemetry/api-logs',
  ],
  outputFileTracingIncludes: {
    '/api/admin/migrate': ['./src/db/migrations/**/*'],
  },
  async rewrites() {
    if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return []

    return [
      {
        source: '/ingest/static/:path*',
        destination: `${posthogStaticHost}/static/:path*`,
      },
      {
        source: '/ingest/array/:path*',
        destination: `${posthogStaticHost}/array/:path*`,
      },
      {
        source: '/ingest/:path*',
        destination: `${posthogIngestHost}/:path*`,
      },
    ]
  },
  // Required for PostHog trailing-slash API requests.
  skipTrailingSlashRedirect: true,
  // No remotePatterns: the only <Image> consumer (product thumbnails, which point at
  // arbitrary external URLs from CSV/WooCommerce import or manual paste) renders `unoptimized`,
  // so the Next.js image optimizer never fetches these URLs server-side. Allowing a wildcard
  // host here would otherwise make `/_next/image?url=` an open SSRF proxy.
}

export default nextConfig
