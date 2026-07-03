'use client'

import { VentasStatusNav } from '@/components/erp/VentasStatusNav'

export type PresupuestosStatusTab = '' | 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'cancelled'

export const PRESUPUESTOS_STATUS_TABS: { key: PresupuestosStatusTab; label: string }[] = [
  { key: '',          label: 'Todos' },
  { key: 'draft',     label: 'Borrador' },
  { key: 'sent',      label: 'Enviado' },
  { key: 'accepted',  label: 'Aceptado' },
  { key: 'rejected',  label: 'Rechazado' },
  { key: 'expired',   label: 'Vencido' },
  { key: 'cancelled', label: 'Cancelado' },
]

export interface PresupuestosStatusNavProps {
  active: PresupuestosStatusTab
  counts: Record<PresupuestosStatusTab, number>
  onChange: (tab: PresupuestosStatusTab) => void
}

export function PresupuestosStatusNav({ active, counts, onChange }: PresupuestosStatusNavProps) {
  return (
    <VentasStatusNav
      tabs={PRESUPUESTOS_STATUS_TABS}
      active={active}
      counts={counts}
      onChange={onChange}
      ariaLabel="Filtrar presupuestos por estado"
    />
  )
}
