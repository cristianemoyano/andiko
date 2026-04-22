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
  bold,
  className,
}: {
  label: string
  value: string | number
  bold?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4', className)}>
      <span className={cn('text-[12px] text-zinc-500', bold && 'font-semibold text-zinc-900')}>
        {label}
      </span>
      <span className={cn('text-[13px] tabular-nums text-zinc-700', bold && 'font-semibold text-zinc-900 text-[15px]')}>
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
    <div className={cn('flex flex-col gap-1.5 rounded-sm border border-zinc-200 bg-zinc-50 p-4', className)}>
      <TotalsRow label="Subtotal" value={subtotal} />

      {hasDiscount && (
        <TotalsRow
          label="Descuento"
          value={`-${formatARS(discountAmount)}`}
          className="text-red-600"
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

      <div className="my-1 border-t border-zinc-200" />
      <TotalsRow label="Total" value={total} bold />
    </div>
  )
}

export { TotalsFooter }
