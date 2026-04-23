import type { Metadata } from 'next'
import { CuentaCorrienteClient } from './CuentaCorrienteClient'

export const metadata: Metadata = {
  title: 'Cuenta Corriente — Ventas',
}

export default function CuentaCorrientePage() {
  return <CuentaCorrienteClient />
}
