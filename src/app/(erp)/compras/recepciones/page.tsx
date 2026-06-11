import type { Metadata } from 'next'
import { RecepcionesClient } from './RecepcionesClient'

export const metadata: Metadata = { title: 'Recepciones de mercadería' }

export default function RecepcionesPage() {
  return <RecepcionesClient />
}
