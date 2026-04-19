import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['sequelize', 'pg', 'pg-hstore', 'pg-native', 'pino', 'pino-pretty'],
}

export default nextConfig
