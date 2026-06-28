'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/compras/ordenes',    label: 'Órdenes de compra' },
  { href: '/compras/recepciones', label: 'Recepciones' },
  { href: '/compras/devoluciones', label: 'Devoluciones' },
  { href: '/compras/facturas',   label: 'Facturas proveedor' },
  { href: '/compras/pagos',            label: 'Pagos' },
  { href: '/compras/cuenta-corriente', label: 'Cuenta corriente' },
  { href: '/compras/conciliacion',     label: 'Conciliación' },
] as const

export function ComprasSubNav() {
  const pathname = usePathname()
  return (
    <nav
      className="flex gap-1 overflow-x-auto px-5 py-2 bg-surface-muted border-b border-border flex-shrink-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Secciones de compras"
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
