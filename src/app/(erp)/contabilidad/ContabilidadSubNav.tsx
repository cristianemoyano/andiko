'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/contabilidad/asientos', label: 'Asientos' },
  { href: '/contabilidad/plan-de-cuentas', label: 'Plan de cuentas' },
  { href: '/contabilidad/balance', label: 'Balance de sumas y saldos' },
  { href: '/contabilidad/libro-iva/ventas', label: 'Libro IVA Ventas' },
  { href: '/contabilidad/libro-iva/compras', label: 'Libro IVA Compras' },
  { href: '/contabilidad/reportes/ventas', label: 'Reportes ventas' },
  { href: '/contabilidad/reportes/compras', label: 'Reportes compras' },
] as const

export function ContabilidadSubNav() {
  const pathname = usePathname()
  return (
    <nav
      className="flex gap-1 overflow-x-auto px-5 py-2 bg-surface-muted border-b border-border flex-shrink-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Secciones de contabilidad"
    >
      {LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'shrink-0 whitespace-nowrap px-3 py-1 text-[13px] rounded-sm transition-colors',
            pathname.startsWith(href)
              ? 'bg-surface border border-border text-fg font-medium shadow-sm'
              : 'text-fg-muted hover:text-fg hover:bg-surface-hover/80'
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
