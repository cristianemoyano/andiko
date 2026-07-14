import type { Metadata } from 'next'
import { EmpleadosClient } from './EmpleadosClient'

export const metadata: Metadata = { title: 'Empleados — Control de Horario' }

export default function EmpleadosPage() {
  return <EmpleadosClient />
}
