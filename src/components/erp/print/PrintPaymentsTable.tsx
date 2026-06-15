import { cn } from '@/lib/utils'
import type { PrintablePaymentRow } from '@/types/printing'

export interface PrintPaymentsTableProps {
  payments: PrintablePaymentRow[]
  title?: string
  className?: string
}

export function PrintPaymentsTable({ payments, title = 'Pagos', className }: PrintPaymentsTableProps) {
  if (payments.length === 0) return null
  return (
    <section className={cn('mt-8', className)}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{title}</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border-strong text-left text-xs uppercase text-fg-muted print:border-border-strong">
              <th className="py-2 pr-2">Número</th>
              <th className="py-2 pr-2">Fecha</th>
              <th className="py-2 pr-2">Método</th>
              <th className="py-2 pr-2">Ref.</th>
              <th className="w-28 py-2 text-right">Importe</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p, idx) => (
              <tr key={idx} className="border-b border-border print:border-border">
                <td className="py-2 pr-2 font-mono">{p.payment_number}</td>
                <td className="py-2 pr-2">{p.payment_date}</td>
                <td className="py-2 pr-2">{p.payment_method}</td>
                <td className="py-2 pr-2 text-fg-muted">{p.reference ?? '—'}</td>
                <td className="py-2 text-right font-mono">{p.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
