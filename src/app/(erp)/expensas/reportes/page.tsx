import type { Metadata } from 'next'
import { ReportesExpensasClient } from './ReportesExpensasClient'

export const metadata: Metadata = { title: 'Reportes de Expensas' }

export default function ReportesExpensasPage() {
  return <ReportesExpensasClient />
}
