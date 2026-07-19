import { cn } from '@/lib/utils'
import { formatARS } from '@/components/primitives/CurrencyInput'

export interface TaxBreakdownItem {
  rate: string
  base: string
  amount: string
}

export interface TotalsFooterProps {
  subtotal: string | number
  discountAmount?: string | number
  taxBreakdown?: TaxBreakdownItem[]
  taxAmount: string | number
  total: string | number
  className?: string
}

function TotalsRow({
  label,
  value,
  className,
}: {
  label: string
  value: string | number
  className?: string
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4', className)}>
      <span className="text-[13px] text-fg-muted">
        {label}
      </span>
      <span className="text-sm tabular-nums text-fg">
        {formatARS(value)}
      </span>
    </div>
  )
}

function TotalsFooter({
  subtotal,
  discountAmount,
  taxBreakdown,
  taxAmount,
  total,
  className,
}: TotalsFooterProps) {
  const hasDiscount = discountAmount !== undefined && Number(discountAmount) > 0

  return (
    <div className={cn('flex flex-col gap-2 rounded-md border border-brand-accent-border/60 bg-brand-accent-bg/40 p-4', className)}>
      <TotalsRow label="Subtotal" value={subtotal} />

      {hasDiscount && (
        <TotalsRow
          label="Descuento"
          value={`-${formatARS(discountAmount)}`}
          className="text-danger"
        />
      )}

      {taxBreakdown && taxBreakdown.length > 0 ? (
        taxBreakdown.map(item => (
          <TotalsRow
            key={item.rate}
            label={`IVA ${item.rate}% (base ${formatARS(item.base)})`}
            value={item.amount}
          />
        ))
      ) : (
        <TotalsRow label="IVA" value={taxAmount} />
      )}

      <div className="my-1 border-t border-brand-accent-border/50" />
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-semibold text-fg">Total</span>
        <span className="text-xl font-semibold tabular-nums tracking-tight text-fg">
          {formatARS(total)}
        </span>
      </div>
    </div>
  )
}

export { TotalsFooter }
