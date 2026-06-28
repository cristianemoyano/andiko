import type { Metadata } from 'next'
import { VentasReportesClient } from '../../../ventas/reportes/ReportesClient'
import { ContabilidadSubNav } from '../../ContabilidadSubNav'

export const metadata: Metadata = { title: 'Reportes ventas — Contabilidad' }

export default function ReportesVentasContabilidadPage() {
  return (
    <VentasReportesClient
      subnav={<ContabilidadSubNav />}
      breadcrumbs={[
        { label: 'Contabilidad', href: '/contabilidad/asientos' },
        { label: 'Reportes ventas' },
      ]}
    />
  )
}
