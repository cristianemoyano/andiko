import type { Metadata } from 'next'
import { NotasDeDebitoClient } from './NotasDeDebitoClient'

export const metadata: Metadata = { title: 'Notas de débito — Ventas' }

export default function NotasDeDebitoPage() {
  return <NotasDeDebitoClient />
}
