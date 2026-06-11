import type { Metadata } from 'next'
import { MediosDePagoClient } from './MediosDePagoClient'

export const metadata: Metadata = { title: 'Medios de pago POS — Andiko ERP' }

export default function MediosDePagoPage() {
  return <MediosDePagoClient />
}
