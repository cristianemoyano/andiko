import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Catálogo — Andiko ERP' }

export default function CatalogoPage() {
  redirect('/catalogo/productos')
}
