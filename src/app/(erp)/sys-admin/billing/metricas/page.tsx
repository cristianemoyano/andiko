import type { Metadata } from 'next'
import { MetricasClient } from './MetricasClient'

export const metadata: Metadata = { title: 'Métricas de billing — Andiko ERP' }

export default function MetricasPage() {
  return <MetricasClient />
}
