import { cn } from '@/lib/utils'
import { PrintDraftBanner } from './PrintDraftBanner'
import type { PrintableDocument } from '@/types/printing'

export interface PrintShellProps {
  document: PrintableDocument
  children: React.ReactNode
  className?: string
}

export function PrintShell({ document: doc, children, className }: PrintShellProps) {
  const t = doc.template
  const counterpartyLabel = doc.counterparty_role === 'supplier' ? 'Proveedor' : 'Cliente'

  const showLogo = t.sections.logo && !!t.logo_url
  const showFiscal =
    t.sections.fiscal_block &&
    (!!doc.issuer.legal_name || !!doc.issuer.cuit || !!doc.issuer.iva_condition_label || !!doc.issuer.fiscal_address)
  const showBranch = t.sections.branch && !!doc.branch
  const showCounterparty = t.sections.counterparty && !!doc.counterparty
  const showNotes = t.sections.notes && !!doc.notes
  const showFooter = t.sections.footer && !!t.footer_text

  // Runtime, per-org presentation values — expressed as CSS variables so Tailwind
  // utilities (text/border via the var) stay declarative. Accent + font are
  // user-configured at runtime and cannot be Tailwind class names.
  const shellStyle = {
    '--print-accent': t.accent_color,
    fontFamily: t.font_css,
  } as React.CSSProperties

  return (
    <div
      style={shellStyle}
      className={cn(
        'mx-auto min-h-[297mm] w-[210mm] max-w-full bg-white p-8 text-zinc-900 shadow-sm print:min-h-0 print:w-full print:max-w-none print:p-6 print:shadow-none',
        className,
      )}
    >
      {doc.isDraft ? <PrintDraftBanner className="mb-6" /> : null}

      <header className="border-b border-zinc-200 pb-4 print:border-zinc-400">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            {showLogo ? (
              // eslint-disable-next-line @next/next/no-img-element -- runtime org logo (data-URL or external), no build-time optimization possible
              <img
                src={t.logo_url!}
                alt={`Logo ${doc.issuer.name}`}
                className="h-12 w-auto max-w-[160px] object-contain"
              />
            ) : null}
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{doc.issuer.name}</p>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--print-accent)' }}>
                {doc.title}
              </h1>
              <p className="mt-1 font-mono text-sm text-zinc-600">{doc.document_number}</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p>
              <span className="text-zinc-500">Estado: </span>
              <span className="font-medium">{doc.status_label}</span>
            </p>
            <p className="mt-1 text-zinc-500">{doc.currency}</p>
          </div>
        </div>

        {showFiscal ? (
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {doc.issuer.legal_name ? (
              <div className="flex gap-1.5">
                <dt className="text-zinc-500">Razón social:</dt>
                <dd className="font-medium">{doc.issuer.legal_name}</dd>
              </div>
            ) : null}
            {doc.issuer.cuit ? (
              <div className="flex gap-1.5">
                <dt className="text-zinc-500">CUIT:</dt>
                <dd className="font-medium">{doc.issuer.cuit}</dd>
              </div>
            ) : null}
            {doc.issuer.iva_condition_label ? (
              <div className="flex gap-1.5">
                <dt className="text-zinc-500">Condición IVA:</dt>
                <dd className="font-medium">{doc.issuer.iva_condition_label}</dd>
              </div>
            ) : null}
            {doc.issuer.fiscal_address ? (
              <div className="flex gap-1.5">
                <dt className="text-zinc-500">Domicilio:</dt>
                <dd className="font-medium">{doc.issuer.fiscal_address}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

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

      {showBranch ? (
        <p className="mt-4 text-sm text-zinc-600">
          Sucursal:{' '}
          <span className="font-medium text-zinc-900">
            {doc.branch!.name} ({doc.branch!.branch_code})
          </span>
        </p>
      ) : null}

      {showCounterparty ? (
        <section className="mt-6 rounded-md border border-zinc-200 p-4 print:border-zinc-400">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{counterpartyLabel}</h2>
          <p className="mt-1 font-medium">{doc.counterparty!.legal_name}</p>
          {doc.counterparty!.trade_name ? (
            <p className="text-sm text-zinc-600">{doc.counterparty!.trade_name}</p>
          ) : null}
        </section>
      ) : null}

      <div className="mt-8">{children}</div>

      {showNotes ? (
        <footer className="mt-10 border-t border-zinc-200 pt-4 text-sm text-zinc-700 print:border-zinc-400">
          <h3 className="text-xs font-semibold uppercase text-zinc-500">Notas</h3>
          <p className="mt-2 whitespace-pre-wrap">{doc.notes}</p>
        </footer>
      ) : null}

      {showFooter ? (
        <p className="mt-8 border-t border-zinc-200 pt-3 text-center text-xs text-zinc-500 print:border-zinc-400">
          {t.footer_text}
        </p>
      ) : null}
    </div>
  )
}
