import type { Metadata } from 'next'
import { EmailSettingsClient } from './EmailSettingsClient'

export const metadata: Metadata = { title: 'Email (SMTP) — Sys-admin' }

export default function SysAdminEmailPage() {
  return <EmailSettingsClient />
}
