import type { Metadata } from 'next'
import { SinAccesoClient } from './SinAccesoClient'

export const metadata: Metadata = { title: 'Sin acceso — Andiko ERP' }

export default function SinAccesoPage() {
  return <SinAccesoClient />
}
