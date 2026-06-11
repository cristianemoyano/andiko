import type { Metadata } from 'next'
import { PrintDocumentPageClient } from '@/components/erp/print'

export const metadata: Metadata = { title: 'Imprimir factura proveedor' }

export default async function PrintSupplierInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PrintDocumentPageClient domain="purchases" resource="invoices" id={id} />
}
