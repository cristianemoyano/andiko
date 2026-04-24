import { cn } from '@/lib/utils'
import type { PrintableTotals } from '@/types/printing'

export interface PrintTotalsBlockProps {
  totals: PrintableTotals
  className?: string
}

export function PrintTotalsBlock({ totals, className }: PrintTotalsBlockProps) {
  return (
    <div className={cn('mt-6 flex justify-end', className)}>
      <dl className="w-full max-w-xs space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-600">Subtotal</dt>
          <dd className="font-mono font-medium">{totals.subtotal}</dd>
        </div>
        {totals.discount_amount != null && totals.discount_amount !== '0' && totals.discount_amount !== '0.00' ? (
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-600">Descuento</dt>
            <dd className="font-mono">{totals.discount_amount}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-600">IVA</dt>
          <dd className="font-mono font-medium">{totals.tax_amount}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-zinc-300 pt-2 text-base font-semibold print:border-zinc-500">
          <dt>Total</dt>
          <dd className="font-mono">{totals.total}</dd>
        </div>
      </dl>
    </div>
  )
}
