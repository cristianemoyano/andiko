import type { Metadata } from 'next'
import { PrintDocumentPageClient } from '@/components/erp/print'

export const metadata: Metadata = { title: 'Imprimir pedido' }

export default async function PrintOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PrintDocumentPageClient domain="sales" resource="orders" id={id} />
}
