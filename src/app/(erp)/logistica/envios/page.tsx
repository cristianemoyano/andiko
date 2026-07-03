import type { Metadata } from 'next'
import { EnviosClient } from './EnviosClient'

export const metadata: Metadata = { title: 'Envíos — Logística' }

export default function EnviosPage() {
  return <EnviosClient />
}
