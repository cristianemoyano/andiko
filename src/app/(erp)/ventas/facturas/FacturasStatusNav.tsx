'use client'

import { VentasStatusNav } from '@/components/erp/VentasStatusNav'

export type FacturasStatusTab = '' | 'draft' | 'issued' | 'partially_paid' | 'paid' | 'cancelled'

export const FACTURAS_STATUS_TABS: { key: FacturasStatusTab; label: string }[] = [
  { key: '',               label: 'Todos' },
  { key: 'draft',          label: 'Borrador' },
  { key: 'issued',         label: 'Emitida' },
  { key: 'partially_paid', label: 'Pago parcial' },
  { key: 'paid',           label: 'Pagada' },
  { key: 'cancelled',      label: 'Anulada' },
]

export interface FacturasStatusNavProps {
  active: FacturasStatusTab
  counts: Record<FacturasStatusTab, number>
  onChange: (tab: FacturasStatusTab) => void
}

export function FacturasStatusNav({ active, counts, onChange }: FacturasStatusNavProps) {
  return (
    <VentasStatusNav
      tabs={FACTURAS_STATUS_TABS}
      active={active}
      counts={counts}
      onChange={onChange}
      ariaLabel="Filtrar facturas por estado"
    />
  )
}
