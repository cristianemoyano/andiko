import type { Metadata } from 'next'
import { env } from '@/config/env'

export const siteUrl = env.AUTH_URL.replace(/\/$/, '')

export const siteConfig = {
  name: 'Andiko',
  title: 'Andiko — Software de gestión integral para pymes',
  tagline: 'Gestión integral',
  description:
    'Software de gestión para pymes. Contactos, catálogo, ventas, inventario, compras, contabilidad y POS en un solo lugar, con facturación electrónica incluida.',
  locale: 'es_AR',
  language: 'es-AR',
  social: {
    instagram: 'https://www.instagram.com/andiko.erp/',
    facebook: 'https://www.facebook.com/andiko.erp',
  },
} as const

/** Rutas internas del ERP que no deben indexarse. */
export const privatePathPrefixes = [
  '/api/',
  '/panel',
  '/login',
  '/onboarding',
  '/ventas',
  '/compras',
  '/inventario',
  '/contactos',
  '/catalogo',
  '/configuracion',
  '/perfil',
  '/pos',
  '/sys-admin',
] as const

export function createPageMetadata({
  title,
  description = siteConfig.description,
  path = '',
  index = true,
}: {
  title: string
  description?: string
  path?: string
  index?: boolean
}): Metadata {
  const url = `${siteUrl}${path}`

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: index
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      type: 'website',
      locale: siteConfig.locale,
      url,
      siteName: siteConfig.name,
      title,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}
