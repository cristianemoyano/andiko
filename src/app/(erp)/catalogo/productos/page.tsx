import type { Metadata } from 'next'
import { CatalogoClient } from '../CatalogoClient'

export const metadata: Metadata = { title: 'Productos — Catálogo' }

export default function ProductosPage() {
  return <CatalogoClient />
}
