import type { Metadata } from 'next'
import { CuentaCorrienteProveedorClient } from './CuentaCorrienteProveedorClient'

export const metadata: Metadata = { title: 'Cuenta corriente proveedores — Compras' }

export default function CuentaCorrienteProveedorPage() {
  return <CuentaCorrienteProveedorClient />
}
