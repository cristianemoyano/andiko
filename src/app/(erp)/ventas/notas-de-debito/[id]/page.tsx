import type { Metadata } from 'next'
import { DebitNoteDetail } from './DebitNoteDetail'

export const metadata: Metadata = { title: 'Nota de débito — Ventas' }

export default function DebitNoteDetailPage() {
  return <DebitNoteDetail />
}
