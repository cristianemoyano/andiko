import type { Metadata } from 'next'
import { ReportesClient } from './ReportesClient'

export const metadata: Metadata = { title: 'Reportes — Ventas' }

export default function ReportesVentasPage() {
  return <ReportesClient />
}
