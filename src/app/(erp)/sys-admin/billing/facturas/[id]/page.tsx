import type { Metadata } from 'next'
import { BillingInvoiceDetail } from './BillingInvoiceDetail'

export const metadata: Metadata = { title: 'Factura — Andiko ERP' }

export default async function BillingInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <BillingInvoiceDetail invoiceId={id} />
}
