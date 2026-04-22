'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/ventas/presupuestos', label: 'Presupuestos' },
  { href: '/ventas/pedidos', label: 'Pedidos' },
  { href: '/ventas/facturas', label: 'Facturas' },
] as const

export function VentasSubNav() {
  const pathname = usePathname()
  return (
    <nav
      className="flex gap-1 px-5 py-2 bg-zinc-50 border-b border-zinc-200 flex-shrink-0"
      aria-label="Secciones de ventas"
    >
      {LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'px-3 py-1 text-[13px] rounded-sm transition-colors',
            pathname.startsWith(href)
              ? 'bg-white border border-zinc-200 text-zinc-900 font-medium shadow-sm'
              : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/80'
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
