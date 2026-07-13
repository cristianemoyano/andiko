import type { Metadata } from 'next'
import { MiFichajeClient } from './MiFichajeClient'

export const metadata: Metadata = { title: 'Mi fichaje — Control de Horario' }

export default function ControlHorarioPage() {
  return <MiFichajeClient />
}
