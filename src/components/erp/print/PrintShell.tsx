import { cn } from '@/lib/utils'
import { PrintDraftBanner } from './PrintDraftBanner'
import type { PrintableDocument } from '@/types/printing'

export interface PrintShellProps {
  document: PrintableDocument
  children: React.ReactNode
  className?: string
}

export function PrintShell({ document: doc, children, className }: PrintShellProps) {
  const counterpartyLabel = doc.counterparty_role === 'supplier' ? 'Proveedor' : 'Cliente'
  return (
    <div
      className={cn(
        'mx-auto min-h-[297mm] w-[210mm] max-w-full bg-white p-8 text-zinc-900 shadow-sm print:min-h-0 print:w-full print:max-w-none print:p-6 print:shadow-none',
        className,
      )}
    >
      {doc.isDraft ? <PrintDraftBanner className="mb-6" /> : null}

      <header className="border-b border-zinc-200 pb-4 print:border-zinc-400">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{doc.issuer.name}</p>
            <h1 className="text-xl font-semibold">{doc.title}</h1>
            <p className="mt-1 font-mono text-sm text-zinc-600">{doc.document_number}</p>
          </div>
          <div className="text-right text-sm">
            <p>
              <span className="text-zinc-500">Estado: </span>
              <span className="font-medium">{doc.status_label}</span>
            </p>
            <p className="mt-1 text-zinc-500">{doc.currency}</p>
          </div>
        </div>
        {doc.meta_dates.length > 0 ? (
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {doc.meta_dates.map(row => (
              <div key={row.label}>
                <dt className="text-zinc-500">{row.label}</dt>
                <dd className="font-medium">{row.value ?? '—'}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {doc.payment_condition_label ? (
          <p className="mt-3 text-sm text-zinc-600">
            Condición de pago: <span className="font-medium text-zinc-900">{doc.payment_condition_label}</span>
          </p>
        ) : null}
      </header>

      {doc.branch ? (
        <p className="mt-4 text-sm text-zinc-600">
          Sucursal:{' '}
          <span className="font-medium text-zinc-900">
            {doc.branch.name} ({doc.branch.branch_code})
          </span>
        </p>
      ) : null}

      {doc.counterparty ? (
        <section className="mt-6 rounded-md border border-zinc-200 p-4 print:border-zinc-400">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{counterpartyLabel}</h2>
          <p className="mt-1 font-medium">{doc.counterparty.legal_name}</p>
          {doc.counterparty.trade_name ? (
            <p className="text-sm text-zinc-600">{doc.counterparty.trade_name}</p>
          ) : null}
        </section>
      ) : null}

      <div className="mt-8">{children}</div>

      {doc.notes ? (
        <footer className="mt-10 border-t border-zinc-200 pt-4 text-sm text-zinc-700 print:border-zinc-400">
          <h3 className="text-xs font-semibold uppercase text-zinc-500">Notas</h3>
          <p className="mt-2 whitespace-pre-wrap">{doc.notes}</p>
        </footer>
      ) : null}
    </div>
  )
}
