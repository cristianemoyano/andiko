import type { Metadata } from 'next'
import { DispositivosClient } from './DispositivosClient'

export const metadata: Metadata = { title: 'Dispositivos POS — Andiko ERP' }

export default function DispositivosPage() {
  return <DispositivosClient />
}
