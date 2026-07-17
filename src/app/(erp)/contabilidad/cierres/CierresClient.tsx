'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Badge } from '@/components/primitives/Badge'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { ContabilidadSubNav } from '../ContabilidadSubNav'

type PeriodEntryRef = { id: string; entry_number: string } | null

type AccountingPeriodItem = {
  id: string
  start_date: string
  end_date: string
  status: string
  notes: string | null
  closing_entry: PeriodEntryRef
  reversal_entry: PeriodEntryRef
}

type PeriodsResponse = { data: AccountingPeriodItem[] }

function previousMonthRange(): { from: string; to: string } {
  const now = new Date()
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastOfPrevMonth = new Date(firstOfThisMonth.getTime() - 24 * 60 * 60 * 1000)
  const firstOfPrevMonth = new Date(lastOfPrevMonth.getFullYear(), lastOfPrevMonth.getMonth(), 1)
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: iso(firstOfPrevMonth), to: iso(lastOfPrevMonth) }
}

function formatDate(dateOnly: string): string {
  const [y, m, d] = dateOnly.split('-')
  return `${d}/${m}/${y}`
}

export function CierresClient() {
  const defaults = previousMonthRange()
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [periods, setPeriods] = useState<AccountingPeriodItem[]>([])
  const [refresh, setRefresh] = useState(0)
  const [serverError, setServerError] = useState<string | null>(null)
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false)
  const [reopenTarget, setReopenTarget] = useState<AccountingPeriodItem | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetchJson<PeriodsResponse>('/api/v1/accounting/periods?limit=50')
        if (!mounted) return
        setPeriods(res.data)
      } catch (e) {
        if (!mounted) return
        setServerError(getApiErrorMessage(e))
      }
    })()
    return () => { mounted = false }
  }, [refresh])

  async function handleClose() {
    setSubmitting(true)
    setServerError(null)
    try {
      await fetchJson('/api/v1/accounting/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
      })
      setRefresh(r => r + 1)
    } catch (e) {
      setServerError(getApiErrorMessage(e))
    } finally {
      setSubmitting(false)
      setCloseConfirmOpen(false)
    }
  }

  async function handleReopen() {
    if (!reopenTarget) return
    setSubmitting(true)
    setServerError(null)
    try {
      await fetchJson(`/api/v1/accounting/periods/${reopenTarget.id}/reopen`, { method: 'POST' })
      setRefresh(r => r + 1)
    } catch (e) {
      setServerError(getApiErrorMessage(e))
    } finally {
      setSubmitting(false)
      setReopenTarget(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar breadcrumbs={[{ label: 'Contabilidad', href: '/contabilidad/asientos' }, { label: 'Cierres de período' }]} />
      <ContabilidadSubNav />

      <PageBody>
        <div className="mb-5 rounded-sm border border-border bg-surface-muted p-4">
          <h2 className="text-[14px] font-medium text-fg mb-1">Cerrar período</h2>
          <p className="text-[12px] text-fg-muted mb-3">
            Genera un asiento que cancela las cuentas de resultado contra Resultado del ejercicio (3.2.02).
            Después del cierre no se pueden contabilizar asientos manuales con fecha dentro del período;
            los comprobantes con fecha dentro de un período cerrado se imputan automáticamente al primer día abierto.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-fg-muted">Desde</label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-fg-muted">Hasta</label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40" />
            </div>
            <Button
              variant="primary"
              size="sm"
              disabled={!from || !to || from > to || submitting}
              onClick={() => setCloseConfirmOpen(true)}
            >
              Cerrar período
            </Button>
          </div>
        </div>

        {serverError && (
          <div className="mb-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">{serverError}</div>
        )}

        <div className="border border-border rounded-sm overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-surface-muted text-fg-muted">
              <tr>
                <th className="text-left font-medium px-3 py-2">Período</th>
                <th className="text-left font-medium px-3 py-2">Estado</th>
                <th className="text-left font-medium px-3 py-2">Asiento de cierre</th>
                <th className="text-left font-medium px-3 py-2">Asiento de reversión</th>
                <th className="text-right font-medium px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {periods.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-fg-subtle">Todavía no hay cierres de período.</td></tr>
              )}
              {periods.map(period => (
                <tr key={period.id} className="border-t border-border">
                  <td className="px-3 py-1.5 text-fg">
                    {formatDate(period.start_date)} — {formatDate(period.end_date)}
                  </td>
                  <td className="px-3 py-1.5">
                    <Badge status={period.status === 'closed' ? 'success' : 'pending'} dot>
                      {period.status === 'closed' ? 'Cerrado' : 'Reabierto'}
                    </Badge>
                  </td>
                  <td className="px-3 py-1.5">
                    {period.closing_entry ? (
                      <Link href="/contabilidad/asientos" className="text-brand hover:underline font-mono text-[12px]">
                        {period.closing_entry.entry_number}
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-1.5">
                    {period.reversal_entry ? (
                      <Link href="/contabilidad/asientos" className="text-brand hover:underline font-mono text-[12px]">
                        {period.reversal_entry.entry_number}
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {period.status === 'closed' && (
                      <Button variant="ghost" size="sm" disabled={submitting} onClick={() => setReopenTarget(period)}>
                        Reabrir
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageBody>

      <ConfirmDialog
        open={closeConfirmOpen}
        onOpenChange={setCloseConfirmOpen}
        title="Cerrar período contable"
        description={`Se va a generar el asiento de cierre para el período ${formatDate(from || '0000-00-00')} — ${formatDate(to || '0000-00-00')}. Después del cierre no se podrán contabilizar asientos con fecha dentro del período.`}
        variant="warning"
        confirmLabel="Cerrar período"
        onConfirm={handleClose}
      />

      <ConfirmDialog
        open={reopenTarget !== null}
        onOpenChange={(open) => { if (!open) setReopenTarget(null) }}
        title="Reabrir período"
        description={
          reopenTarget
            ? `Se va a generar un asiento de reversión del cierre ${formatDate(reopenTarget.start_date)} — ${formatDate(reopenTarget.end_date)}. El asiento de cierre original no se elimina.`
            : ''
        }
        variant="danger"
        confirmLabel="Reabrir"
        onConfirm={handleReopen}
      />
    </div>
  )
}
