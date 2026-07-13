import type { Metadata } from 'next'
import { RecetasClient } from './RecetasClient'

export const metadata: Metadata = { title: 'Recetas (BOM)' }

export default function RecetasPage() {
  return <RecetasClient />
}
