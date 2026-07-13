import type { Metadata } from 'next'
import { AutomationClient } from './AutomationClient'

export const metadata: Metadata = { title: 'Automatización de facturación — Andiko ERP' }

export default function BillingAutomationPage() {
  return <AutomationClient />
}
