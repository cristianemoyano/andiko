import type { Metadata } from 'next'
import { NuevoPresupuestoClient } from './NuevoPresupuestoClient'

export const metadata: Metadata = { title: 'Nuevo presupuesto — Ventas' }

export default function NuevoPresupuestoPage() {
  return <NuevoPresupuestoClient />
}
