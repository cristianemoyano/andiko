'use client'

import type { PrintableDocument } from '@/types/printing'
import { PrintShell } from './PrintShell'
import { PrintLineItemsTable } from './PrintLineItemsTable'
import { PrintTotalsBlock } from './PrintTotalsBlock'
import { PrintPaymentsTable } from './PrintPaymentsTable'

export interface PrintDocumentRendererProps {
  document: PrintableDocument
}

export function PrintDocumentRenderer({ document: doc }: PrintDocumentRendererProps) {
  const showTaxColumns = doc.kind !== 'purchase_receipt'
  const showLines = doc.lines.length > 0

  return (
    <PrintShell document={doc}>
      {showLines ? (
        <>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-muted">Detalle</h2>
          <PrintLineItemsTable lines={doc.lines} showTaxColumns={showTaxColumns} />
        </>
      ) : doc.kind === 'supplier_payment' ? (
        <p className="text-sm text-fg-muted">Comprobante de pago registrado en el sistema.</p>
      ) : null}
      <PrintTotalsBlock totals={doc.totals} />
      {doc.payments?.length ? (
        <PrintPaymentsTable
          payments={doc.payments}
          title={doc.domain === 'purchases' ? 'Pagos asociados' : 'Cobros'}
        />
      ) : null}
    </PrintShell>
  )
}
