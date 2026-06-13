import type { Metadata } from 'next'
import { PlanDeCuentasClient } from './PlanDeCuentasClient'

export const metadata: Metadata = { title: 'Plan de cuentas — Contabilidad' }

export default function PlanDeCuentasPage() {
  return <PlanDeCuentasClient />
}
