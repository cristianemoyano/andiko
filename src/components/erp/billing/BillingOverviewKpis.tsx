'use client'

import { cn } from '@/lib/utils'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { usageConsumptionHint } from '@/components/erp/billing/billing-chart-data'

interface BillingKpiCardProps {
  label: string
  value: string
  hint?: string
  featured?: boolean
  tone?: 'default' | 'warning'
}

function BillingKpiCard({ label, value, hint, featured = false, tone = 'default' }: BillingKpiCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border p-5 flex flex-col gap-1.5 min-w-0',
        featured
          ? 'border-brand-accent-border bg-surface shadow-[0_1px_3px_rgba(12,100,122,0.08)]'
          : 'border-border bg-surface',
      )}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-subtle">
        {label}
      </span>
      <span
        className={cn(
          'font-mono tabular-nums leading-none',
          featured ? 'text-2xl sm:text-[28px] font-semibold' : 'text-xl font-medium',
          tone === 'warning' ? 'text-warning' : 'text-fg',
        )}
      >
        {value}
      </span>
      {hint && <span className="text-[12px] text-fg-muted leading-snug">{hint}</span>}
    </div>
  )
}

interface BillingOverviewKpisProps {
  estimatedTotal: string
  estimatedSubtotal: string
  estimatedTax: string
  pendingBalance: string
  registeredUsageTotal: string
  billableUsageTotal: string
  periodLabel?: string
}

export function BillingOverviewKpis({
  estimatedTotal,
  estimatedSubtotal,
  estimatedTax,
  pendingBalance,
  registeredUsageTotal,
  billableUsageTotal,
  periodLabel,
}: BillingOverviewKpisProps) {
  const pendingTone = Number(pendingBalance) > 0 ? 'warning' : 'default'

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
      <BillingKpiCard
        label="Próxima factura (est.)"
        value={formatARS(estimatedTotal)}
        hint={[
          periodLabel ? `Período ${periodLabel}` : null,
          `Neto ${formatARS(estimatedSubtotal)} + IVA ${formatARS(estimatedTax)}`,
        ].filter(Boolean).join(' · ')}
        featured
      />
      <BillingKpiCard
        label="Saldo pendiente"
        value={formatARS(pendingBalance)}
        hint="Facturas emitidas sin pagar"
        tone={pendingTone}
      />
      <BillingKpiCard
        label="Consumo facturable (est.)"
        value={formatARS(billableUsageTotal)}
        hint={usageConsumptionHint(registeredUsageTotal, billableUsageTotal)}
      />
    </div>
  )
}
