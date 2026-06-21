import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LibroIvaClient } from '../../_afip/LibroIvaClient'
import { ComprasSubNav } from '../ComprasSubNav'

export const metadata: Metadata = { title: 'Libro IVA Compras — Compras' }

export default function LibroIvaComprasPage() {
  return (
    <Suspense>
      <LibroIvaClient
        endpoint="/api/v1/afip/libro-iva-compras"
        breadcrumbs={[{ label: 'Compras', href: '/compras/ordenes' }, { label: 'Libro IVA Compras' }]}
        subnav={<ComprasSubNav />}
        counterpartyHeader="Proveedor"
        showCae={false}
      />
    </Suspense>
  )
}
