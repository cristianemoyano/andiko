import type { Metadata } from 'next'
import { NuevaOrdenClient } from './NuevaOrdenClient'

export const metadata: Metadata = { title: 'Nueva orden de compra' }

export default function NuevaOrdenPage() {
  return <NuevaOrdenClient />
}
