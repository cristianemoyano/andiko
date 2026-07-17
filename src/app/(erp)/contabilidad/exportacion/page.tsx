import type { Metadata } from 'next'
import { ExportacionClient } from './ExportacionClient'

export const metadata: Metadata = { title: 'Exportación contable — Contabilidad' }

export default function ExportacionPage() {
  return <ExportacionClient />
}
