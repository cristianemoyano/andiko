'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

type NavLink = {
  href: string
  label: string
  isActive: (pathname: string) => boolean
}

const SECTIONS: { links: NavLink[] }[] = [
  {
    links: [
      {
        href: '/sys-admin/billing',
        label: 'Suscripciones',
        isActive: p =>
          p === '/sys-admin/billing'
          || p.startsWith('/sys-admin/billing/suscripciones')
          || p.startsWith('/sys-admin/billing/facturas'),
      },
      {
        href: '/sys-admin/billing/planes',
        label: 'Planes',
        isActive: p => p.startsWith('/sys-admin/billing/planes'),
      },
    ],
  },
  {
    links: [
      {
        href: '/sys-admin/billing/metricas',
        label: 'Métricas',
        isActive: p => p.startsWith('/sys-admin/billing/metricas'),
      },
      {
        href: '/sys-admin/billing/emisor',
        label: 'Emisor',
        isActive: p => p.startsWith('/sys-admin/billing/emisor'),
      },
    ],
  },
]

export function BillingSubNav() {
  const pathname = usePathname()

  return (
    <nav
      className="flex items-center gap-3 overflow-x-auto px-5 py-2 bg-surface-muted border-b border-border flex-shrink-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Secciones de facturación"
    >
      {SECTIONS.map((section, sectionIdx) => (
        <div key={sectionIdx} className="flex items-center gap-1 shrink-0">
          {sectionIdx > 0 && (
            <span className="hidden sm:block w-px h-5 bg-border mx-1" aria-hidden />
          )}
          {section.links.map(({ href, label, isActive }) => {
            const active = isActive(pathname)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'shrink-0 whitespace-nowrap px-3 py-1 text-[13px] rounded-sm transition-colors',
                  active
                    ? 'bg-surface border border-border text-fg font-medium shadow-sm'
                    : 'text-fg-muted hover:text-fg hover:bg-surface-hover/80',
                )}
              >
                {label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
