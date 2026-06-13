import type { Metadata } from 'next'
import { BalanceClient } from './BalanceClient'

export const metadata: Metadata = { title: 'Balance de sumas y saldos — Contabilidad' }

export default function BalancePage() {
  return <BalanceClient />
}
