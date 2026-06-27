'use client'

import { DataTable, type Column } from '@/components/erp'
import { formatARS } from '@/components/primitives/CurrencyInput'
import type { BillingLineKind } from '@/types'

export interface BillingInvoiceItemRow {
  id: string
  kind?: BillingLineKind | string
  description: string
  quantity: string
  unit_price: string
  total: string
  subtotal?: string
}

const SECTION_ORDER: BillingLineKind[] = [
  'base',
  'adjustment',
  'seat',
  'branch',
  'module_addon',
  'extra_addon',
  'usage',
  'discount',
]

const SECTION_LABELS: Record<string, string> = {
  base: 'Plan contratado',
  adjustment: 'Resumen de capacidad (plan vs uso)',
  seat: 'Usuarios adicionales',
  branch: 'Sucursales adicionales',
  module_addon: 'Módulos',
  extra_addon: 'Servicios adicionales',
  usage: 'Consumo medido del período',
  discount: 'Descuentos',
}

function groupItems(items: BillingInvoiceItemRow[]) {
  const groups = new Map<string, BillingInvoiceItemRow[]>()
  for (const item of items) {
    const kind = item.kind ?? 'base'
    const list = groups.get(kind) ?? []
    list.push(item)
    groups.set(kind, list)
  }

  return SECTION_ORDER
    .filter(kind => groups.has(kind))
    .map(kind => ({ kind, label: SECTION_LABELS[kind] ?? kind, items: groups.get(kind)! }))
}

const columns: Column<BillingInvoiceItemRow>[] = [
  {
    key: 'description',
    header: 'Concepto',
    mobileRole: 'title',
    render: r => (
      <span className={Number(r.subtotal ?? r.total) === 0 && r.kind === 'adjustment' ? 'text-fg-muted' : 'text-fg'}>
        {r.description}
      </span>
    ),
  },
  {
    key: 'quantity',
    header: 'Cantidad',
    align: 'right',
    mobileRole: 'subtitle',
    render: r => <span className="tabular-nums">{r.quantity}</span>,
  },
  {
    key: 'unit_price',
    header: 'Precio unit.',
    align: 'right',
    mobileRole: 'subtitle',
    render: r => (
      <span className="tabular-nums">
        {Number(r.unit_price) === 0 ? 'Incluido' : formatARS(r.unit_price)}
      </span>
    ),
  },
  {
    key: 'total',
    header: 'Importe',
    align: 'right',
    mobileRole: 'amount',
    render: r => (
      <span className="tabular-nums">
        {Number(r.subtotal ?? r.total) === 0 ? '—' : formatARS(r.subtotal ?? r.total)}
      </span>
    ),
  },
]

interface BillingInvoiceItemsBreakdownProps {
  items: BillingInvoiceItemRow[]
  emptyMessage?: string
}

export function BillingInvoiceItemsBreakdown({
  items,
  emptyMessage = 'Sin líneas.',
}: BillingInvoiceItemsBreakdownProps) {
  if (items.length === 0) {
    return <p className="text-[13px] text-fg-muted">{emptyMessage}</p>
  }

  const groups = groupItems(items)

  return (
    <div className="flex flex-col gap-4">
      {groups.map(group => (
        <section key={group.kind}>
          <h3 className="text-[12px] font-semibold text-fg-muted uppercase tracking-wide mb-2">
            {group.label}
          </h3>
          <DataTable
            columns={columns}
            data={group.items}
            keyExtractor={r => r.id}
            emptyMessage={emptyMessage}
          />
        </section>
      ))}
    </div>
  )
}
