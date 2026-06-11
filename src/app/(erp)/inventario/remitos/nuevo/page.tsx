import type { Metadata } from 'next'
import { NuevoRemitoClient } from './NuevoRemitoClient'

export const metadata: Metadata = { title: 'Nuevo remito de entrega' }

export default function NuevoRemitoPage() {
  return <NuevoRemitoClient />
}
