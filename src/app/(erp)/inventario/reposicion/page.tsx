import type { Metadata } from 'next'
import { ReposicionClient } from './ReposicionClient'

export const metadata: Metadata = { title: 'Lista de reposición — Inventario' }

export default function ReposicionPage() {
  return <ReposicionClient />
}
