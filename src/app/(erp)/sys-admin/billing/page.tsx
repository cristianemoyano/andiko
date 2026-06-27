import type { Metadata } from 'next'
import { BillingClient } from './BillingClient'

export const metadata: Metadata = { title: 'Facturación — Andiko ERP' }

export default function BillingPage() {
  return <BillingClient />
}
