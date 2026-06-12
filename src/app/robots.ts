import type { MetadataRoute } from 'next'
import { privatePathPrefixes, siteUrl } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [...privatePathPrefixes],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
