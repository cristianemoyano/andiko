import type { Metadata } from 'next'
import { AjustesPreciosClient } from './AjustesPreciosClient'

export const metadata: Metadata = { title: 'Ajustes de precios — Catálogo — Andiko ERP' }

export default function AjustesPreciosPage() {
  return <AjustesPreciosClient />
}
