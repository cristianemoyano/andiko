import type { Metadata } from 'next'
import { StockClient } from './StockClient'

export const metadata: Metadata = { title: 'Stock — Inventario' }

export default function StockPage() {
  return <StockClient />
}
