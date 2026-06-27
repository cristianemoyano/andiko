'use client'

import { PrintDocumentPageClient } from '@/components/erp/print'

export function BillingInvoicePrintClient({ invoiceId }: { invoiceId: string }) {
  return (
    <PrintDocumentPageClient
      domain="billing"
      resource="invoices"
      id={invoiceId}
      apiUrl={`/api/v1/sys-admin/billing/invoices/${invoiceId}/print`}
    />
  )
}
