import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LibroIvaClient } from '../../_afip/LibroIvaClient'
import { VentasSubNav } from '../VentasSubNav'

export const metadata: Metadata = { title: 'Libro IVA Ventas — Ventas' }

export default function LibroIvaVentasPage() {
  return (
    <Suspense>
      <LibroIvaClient
        endpoint="/api/v1/afip/libro-iva-ventas"
        breadcrumbs={[{ label: 'Ventas', href: '/ventas/presupuestos' }, { label: 'Libro IVA Ventas' }]}
        subnav={<VentasSubNav />}
        counterpartyHeader="Cliente"
        showCae
      />
    </Suspense>
  )
}
