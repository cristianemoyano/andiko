import type { Metadata } from 'next'
import { ConfiguracionClient } from './ConfiguracionClient'

export const metadata: Metadata = { title: 'Configuración — Andiko ERP' }

export default function ConfiguracionPage() {
  return <ConfiguracionClient />
}
