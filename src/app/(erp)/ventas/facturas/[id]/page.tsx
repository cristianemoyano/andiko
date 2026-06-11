import type { Metadata } from 'next'
import { InvoiceDetail } from './InvoiceDetail'

export const metadata: Metadata = { title: 'Factura — Ventas' }

type Props = { params: Promise<{ id: string }> }

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = await params
  return <InvoiceDetail id={id} />
}
