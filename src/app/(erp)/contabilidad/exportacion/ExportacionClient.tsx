'use client'

import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { ContabilidadSubNav } from '../ContabilidadSubNav'

function previousMonthRange(): { from: string; to: string } {
  const now = new Date()
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastOfPrevMonth = new Date(firstOfThisMonth.getTime() - 24 * 60 * 60 * 1000)
  const firstOfPrevMonth = new Date(lastOfPrevMonth.getFullYear(), lastOfPrevMonth.getMonth(), 1)
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: iso(firstOfPrevMonth), to: iso(lastOfPrevMonth) }
}

export function ExportacionClient() {
  const defaults = previousMonthRange()
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)

  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const query = params.toString()

  function download(path: string) {
    window.location.href = `${path}${query ? `?${query}` : ''}`
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar breadcrumbs={[{ label: 'Contabilidad', href: '/contabilidad/asientos' }, { label: 'Exportación' }]} />
      <ContabilidadSubNav />

      <PageBody>
        <div className="max-w-2xl">
          <h2 className="text-[15px] font-medium text-fg mb-1">Exportación para estudio contable</h2>
          <p className="text-[13px] text-fg-muted mb-4">
            Descargá los libros del período en CSV (compatibles con Excel) y envialos a tu estudio contable.
            Solo se incluyen asientos contabilizados.
          </p>

          <div className="flex flex-wrap items-end gap-3 mb-6">
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-fg-muted">Desde</label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-fg-muted">Hasta</label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-sm border border-border bg-surface-muted p-4">
              <h3 className="text-[14px] font-medium text-fg mb-1">Libro diario</h3>
              <p className="text-[12px] text-fg-muted mb-3">
                Todas las líneas de asientos del período: número, fecha, cuenta, debe/haber, origen y sucursal.
              </p>
              <Button
                variant="secondary"
                size="sm"
                disabled={!from || !to || from > to}
                onClick={() => download('/api/v1/accounting/export/libro-diario')}
              >
                Descargar CSV
              </Button>
            </div>
            <div className="rounded-sm border border-border bg-surface-muted p-4">
              <h3 className="text-[14px] font-medium text-fg mb-1">Sumas y saldos</h3>
              <p className="text-[12px] text-fg-muted mb-3">
                Balance de sumas y saldos por cuenta del período, con totales.
              </p>
              <Button
                variant="secondary"
                size="sm"
                disabled={!from || !to || from > to}
                onClick={() => download('/api/v1/accounting/export/sumas-y-saldos')}
              >
                Descargar CSV
              </Button>
            </div>
          </div>
        </div>
      </PageBody>
    </div>
  )
}
