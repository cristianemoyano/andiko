import type { Metadata } from 'next'
import { CuentaCorrienteExpensasClient } from './CuentaCorrienteExpensasClient'

export const metadata: Metadata = { title: 'Cuenta corriente proveedores — Expensas' }

export default function CuentaCorrienteExpensasPage() {
  return <CuentaCorrienteExpensasClient />
}
