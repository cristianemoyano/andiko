import type { Metadata } from 'next'
import { RegistrosClient } from './RegistrosClient'

export const metadata: Metadata = { title: 'Registros — Control de Horario' }

export default function RegistrosPage() {
  return <RegistrosClient />
}
