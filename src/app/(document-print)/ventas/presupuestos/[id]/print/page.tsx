import type { Metadata } from 'next'
import { PrintDocumentPageClient } from '@/components/erp/print'

export const metadata: Metadata = { title: 'Imprimir presupuesto' }

export default async function PrintQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PrintDocumentPageClient domain="sales" resource="quotes" id={id} />
}
