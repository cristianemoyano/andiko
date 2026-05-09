import type { Metadata } from 'next'
import { CreditNoteDetail } from './CreditNoteDetail'

export const metadata: Metadata = { title: 'Nota de crédito — Ventas' }

export default function CreditNoteDetailPage() {
  return <CreditNoteDetail />
}
