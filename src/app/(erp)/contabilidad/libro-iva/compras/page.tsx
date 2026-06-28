import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LibroIvaClient } from '../../../_afip/LibroIvaClient'
import { ContabilidadSubNav } from '../../ContabilidadSubNav'

export const metadata: Metadata = { title: 'Libro IVA Compras — Contabilidad' }

export default function LibroIvaComprasContabilidadPage() {
  return (
    <Suspense>
      <LibroIvaClient
        endpoint="/api/v1/afip/libro-iva-compras"
        breadcrumbs={[
          { label: 'Contabilidad', href: '/contabilidad/asientos' },
          { label: 'Libro IVA Compras' },
        ]}
        subnav={<ContabilidadSubNav />}
        counterpartyHeader="Proveedor"
        showCae={false}
      />
    </Suspense>
  )
}
