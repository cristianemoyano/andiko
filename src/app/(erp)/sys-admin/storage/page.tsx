import type { Metadata } from 'next'
import { StorageSettingsClient } from './StorageSettingsClient'

export const metadata: Metadata = { title: 'Almacenamiento — Sys-admin' }

export default function SysAdminStoragePage() {
  return <StorageSettingsClient />
}
