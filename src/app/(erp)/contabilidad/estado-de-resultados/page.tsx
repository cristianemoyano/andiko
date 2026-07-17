import type { Metadata } from 'next'
import { EstadoDeResultadosClient } from './EstadoDeResultadosClient'

export const metadata: Metadata = { title: 'Estado de resultados — Contabilidad' }

export default function EstadoDeResultadosPage() {
  return <EstadoDeResultadosClient />
}
