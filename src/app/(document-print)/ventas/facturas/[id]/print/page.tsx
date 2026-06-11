import type { Metadata } from 'next'
import { PrintDocumentPageClient } from '@/components/erp/print'

export const metadata: Metadata = { title: 'Imprimir factura' }

export default async function PrintInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PrintDocumentPageClient domain="sales" resource="invoices" id={id} />
}
