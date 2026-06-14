'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/ventas/presupuestos', label: 'Presupuestos' },
  { href: '/ventas/pedidos', label: 'Pedidos' },
  { href: '/ventas/facturas', label: 'Facturas' },
  { href: '/ventas/notas-de-credito', label: 'Notas de crédito' },
  { href: '/ventas/cuenta-corriente', label: 'Cuenta corriente' },
  { href: '/ventas/reportes', label: 'Reportes' },
] as const

export function VentasSubNav() {
  const pathname = usePathname()
  return (
    <nav
      className="flex gap-1 overflow-x-auto px-5 py-2 bg-zinc-50 border-b border-zinc-200 flex-shrink-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Secciones de ventas"
    >
      {LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'shrink-0 whitespace-nowrap px-3 py-1 text-[13px] rounded-sm transition-colors',
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
