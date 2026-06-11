import type { Metadata } from 'next'
import { NotasDeCreditoClient } from './NotasDeCreditoClient'

export const metadata: Metadata = { title: 'Notas de crédito — Ventas' }

export default function NotasDeCreditoPage() {
  return <NotasDeCreditoClient />
}
