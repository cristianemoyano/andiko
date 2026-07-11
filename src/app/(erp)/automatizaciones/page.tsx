import type { Metadata } from 'next'
import { AutomatizacionesClient } from './AutomatizacionesClient'

export const metadata: Metadata = { title: 'Automatizaciones' }

export default function AutomatizacionesPage() {
  return <AutomatizacionesClient />
}
