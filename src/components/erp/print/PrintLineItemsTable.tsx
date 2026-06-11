import { cn } from '@/lib/utils'
import type { PrintableLineItem } from '@/types/printing'

export interface PrintLineItemsTableProps {
  lines: PrintableLineItem[]
  /** When false, hide IVA and amount columns (e.g. recepción simple). */
  showTaxColumns?: boolean
  className?: string
}

export function PrintLineItemsTable({ lines, showTaxColumns = true, className }: PrintLineItemsTableProps) {
  if (lines.length === 0) {
    return <p className={cn('text-sm text-zinc-500', className)}>Sin líneas.</p>
  }
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-300 text-left text-xs uppercase text-zinc-500 print:border-zinc-500">
            <th className="py-2 pr-2">Descripción</th>
            <th className="w-16 py-2 pr-2 text-right">Cant.</th>
            <th className="w-24 py-2 pr-2 text-right">P. unit.</th>
            {showTaxColumns ? (
              <>
                <th className="w-14 py-2 pr-2 text-right">Desc. %</th>
                <th className="w-14 py-2 pr-2 text-right">IVA</th>
                <th className="w-28 py-2 text-right">Total</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => (
            <tr
              key={idx}
              className="border-b border-zinc-100 print:break-inside-avoid print:border-zinc-200"
            >
              <td className="py-2 pr-2 align-top">{line.description}</td>
              <td className="py-2 pr-2 text-right font-mono align-top">{line.quantity}</td>
              <td className="py-2 pr-2 text-right font-mono align-top">{line.unit_price}</td>
              {showTaxColumns ? (
                <>
                  <td className="py-2 pr-2 text-right font-mono align-top">{line.discount_pct ?? '—'}</td>
                  <td className="py-2 pr-2 text-right font-mono align-top">
                    {line.iva_rate != null ? `${line.iva_rate}%` : '—'}
                  </td>
                  <td className="py-2 text-right font-mono align-top">{line.total ?? '—'}</td>
                </>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
