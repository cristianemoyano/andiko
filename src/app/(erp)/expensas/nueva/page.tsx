import type { Metadata } from 'next'
import { NuevoGastoClient } from './NuevoGastoClient'

export const metadata: Metadata = { title: 'Nuevo gasto' }

export default function NuevoGastoPage() {
  return <NuevoGastoClient />
}
