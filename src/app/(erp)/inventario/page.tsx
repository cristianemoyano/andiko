import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Inventario' }

export default function InventarioPage() {
  redirect('/inventario/depositos')
}
