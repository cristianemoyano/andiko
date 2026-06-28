import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LibroIvaClient } from '../../../_afip/LibroIvaClient'
import { ContabilidadSubNav } from '../../ContabilidadSubNav'

export const metadata: Metadata = { title: 'Libro IVA Ventas — Contabilidad' }

export default function LibroIvaVentasContabilidadPage() {
  return (
    <Suspense>
      <LibroIvaClient
        endpoint="/api/v1/afip/libro-iva-ventas"
        breadcrumbs={[
          { label: 'Contabilidad', href: '/contabilidad/asientos' },
          { label: 'Libro IVA Ventas' },
        ]}
        subnav={<ContabilidadSubNav />}
        counterpartyHeader="Cliente"
        showCae
      />
    </Suspense>
  )
}
