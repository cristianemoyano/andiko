import type { Metadata } from 'next'
import { ReportesClient } from './ReportesClient'

export const metadata: Metadata = { title: 'Reportes — Compras' }

export default function ReportesComprasPage() {
  return <ReportesClient />
}
