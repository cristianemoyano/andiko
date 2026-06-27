'use client'

import { useState } from 'react'
import { StatCard } from '@/components/erp'
import { Button } from '@/components/primitives/Button'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { BillingInvoiceItemsBreakdown } from '@/components/erp/billing/BillingInvoiceItemsBreakdown'
import { formatSeatCapacitySummary } from '@/modules/billing/billing-capacity-summary'

export type BillingPreviewLine = {
  kind: string
  label: string
  quantity: string
  unit_price: string
  amount: string
  detail?: string
  isInformational?: boolean
}

export type BillingPreviewWarning = {
  code: 'UNCONFIGURED_METRIC' | 'INACTIVE_METRIC'
  metric_key: string
  quantity: string
  message: string
}

export type BillingUsageSummary = {
  period_start: string
  period_end: string
  lines: { metric_key: string; label: string; unit_label: string | null; quantity: string; unit_price: string; amount: string }[]
  total: string
}

export type BillingPreview = {
  period_start: string
  period_end: string
  lines: BillingPreviewLine[]
  subtotal: string
  tax_amount: string
  total: string
  counts: {
    active_users: number
    active_branches: number
    contracted_seats: number
    included_seats: number
    included_branches: number
  }
  warnings?: BillingPreviewWarning[]
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface BillingPeriodPreviewSectionProps {
  preview: BillingPreview | null
  usage?: BillingUsageSummary | null
  pendingBalance?: string
  showDisclaimer?: boolean
  /** Hide stat cards when the parent already shows them */
  hideStats?: boolean
  /** Collapse the line-item breakdown by default */
  collapsible?: boolean
  defaultExpanded?: boolean
}

export function BillingPeriodPreviewSection({
  preview,
  usage,
  pendingBalance,
  showDisclaimer = true,
  hideStats = false,
  collapsible = false,
  defaultExpanded = true,
}: BillingPeriodPreviewSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  if (!preview) return null

  const meteredTotal = usage?.total ?? '0.00'
  const periodLabel = `${formatDate(preview.period_start)} – ${formatDate(preview.period_end)}`
  const showBreakdown = !collapsible || expanded

  const breakdownItems = preview.lines.map((l, idx) => ({
    id: `${l.kind}-${idx}`,
    kind: l.kind,
    description: l.label,
    quantity: l.quantity,
    unit_price: l.unit_price,
    total: l.amount,
    subtotal: l.amount,
  }))

  return (
    <section className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div>
          <h2 className="text-[13px] font-semibold text-fg">Período actual</h2>
          <p className="text-[12px] text-fg-muted tabular-nums">{periodLabel}</p>
        </div>
        {collapsible && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setExpanded(v => !v)}
            aria-expanded={expanded}
          >
            {expanded ? 'Ocultar detalle' : 'Ver detalle estimado'}
          </Button>
        )}
      </div>

      {!hideStats && (
        <div className="flex flex-wrap gap-3 mb-3">
          <StatCard label="Consumo medido" value={formatARS(meteredTotal)} />
          <StatCard label="Estimación próxima factura" value={formatARS(preview.total)} />
          {pendingBalance !== undefined && (
            <StatCard
              label="Saldo pendiente"
              value={formatARS(pendingBalance)}
              tone={Number(pendingBalance) > 0 ? 'warning' : 'default'}
            />
          )}
        </div>
      )}

      <p className="text-[12px] text-fg-muted mb-2">
        Usuarios: {formatSeatCapacitySummary({
          active: preview.counts.active_users,
          contracted: preview.counts.contracted_seats,
          includedInPlan: preview.counts.included_seats,
        })}
        {' · '}
        Sucursales {preview.counts.active_branches} activas · {preview.counts.included_branches} incluidas en plan
      </p>

      {(preview.warnings?.length ?? 0) > 0 && (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-950">
          <p className="font-medium mb-1">Consumo no facturable detectado</p>
          <ul className="list-disc pl-4 space-y-0.5">
            {preview.warnings!.map(w => (
              <li key={w.metric_key}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}

      {showBreakdown && (
        <>
          <BillingInvoiceItemsBreakdown items={breakdownItems} emptyMessage="Sin cargos estimados para el período." />
          {showDisclaimer && (
            <p className="mt-2 text-[11px] text-fg-subtle">
              Estimación informativa. Al generar la factura se incluirán las mismas secciones con el detalle definitivo.
            </p>
          )}
        </>
      )}
    </section>
  )
}
