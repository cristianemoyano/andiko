'use client'

import { VentasStatusNav } from '@/components/erp/VentasStatusNav'

export type PedidosStatusTab = '' | 'draft' | 'confirmed' | 'in_progress' | 'delivered' | 'returns' | 'cancelled'

export const PEDIDOS_STATUS_TABS: { key: PedidosStatusTab; label: string }[] = [
  { key: '',              label: 'Todos' },
  { key: 'draft',         label: 'Borrador' },
  { key: 'confirmed',     label: 'Confirmado' },
  { key: 'in_progress',   label: 'En preparación' },
  { key: 'delivered',     label: 'Entregado' },
  { key: 'returns',       label: 'Devoluciones' },
  { key: 'cancelled',     label: 'Cancelados' },
]

export interface PedidosStatusNavProps {
  active: PedidosStatusTab
  counts: Record<PedidosStatusTab, number>
  onChange: (tab: PedidosStatusTab) => void
}

export function PedidosStatusNav({ active, counts, onChange }: PedidosStatusNavProps) {
  return (
    <VentasStatusNav
      tabs={PEDIDOS_STATUS_TABS}
      active={active}
      counts={counts}
      onChange={onChange}
      ariaLabel="Filtrar pedidos por estado"
    />
  )
}
