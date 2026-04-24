import type { Metadata } from 'next'
import { PrintDocumentPageClient } from '@/components/erp/print'

export const metadata: Metadata = { title: 'Imprimir recepción' }

export default async function PrintReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PrintDocumentPageClient domain="purchases" resource="receipts" id={id} />
}
