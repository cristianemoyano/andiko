import type { Metadata } from 'next'
import { EtiquetasClient } from './EtiquetasClient'

export const metadata: Metadata = { title: 'Etiquetas de góndola — Catálogo' }

export default function EtiquetasPage() {
  return <EtiquetasClient />
}
