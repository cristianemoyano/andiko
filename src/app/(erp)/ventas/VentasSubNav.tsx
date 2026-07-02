'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { SalesWorkflowHelp } from '@/components/erp/SalesWorkflowHelp'

const LINKS = [
  { href: '/ventas/presupuestos', label: 'Presupuestos' },
  { href: '/ventas/pedidos', label: 'Pedidos' },
  { href: '/ventas/facturas', label: 'Facturas' },
  { href: '/ventas/devoluciones', label: 'Devoluciones' },
  { href: '/ventas/notas-de-credito', label: 'Notas de crédito' },
  { href: '/ventas/notas-de-debito', label: 'Notas de débito' },
  { href: '/ventas/cuenta-corriente', label: 'Cuenta corriente' },
] as const

export function VentasSubNav() {
  const pathname = usePathname()
  return (
    <nav
      className="flex items-center gap-1 overflow-x-auto px-5 py-2 bg-surface-muted border-b border-border flex-shrink-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Secciones de ventas"
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
      <div className="ml-auto shrink-0 pl-2 sticky right-0 bg-surface-muted">
        <SalesWorkflowHelp label={null} side="bottom" align="end" />
      </div>
    </nav>
  )
}
