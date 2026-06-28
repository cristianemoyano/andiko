import type { Metadata } from 'next'
import { ComprasReportesClient } from '../../../compras/reportes/ReportesClient'
import { ContabilidadSubNav } from '../../ContabilidadSubNav'

export const metadata: Metadata = { title: 'Reportes compras — Contabilidad' }

export default function ReportesComprasContabilidadPage() {
  return (
    <ComprasReportesClient
      subnav={<ContabilidadSubNav />}
      breadcrumbs={[
        { label: 'Contabilidad', href: '/contabilidad/asientos' },
        { label: 'Reportes compras' },
      ]}
    />
  )
}
