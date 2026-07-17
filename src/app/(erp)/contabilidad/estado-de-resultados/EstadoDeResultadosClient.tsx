'use client'

import { useState, useEffect, Fragment } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { toCsvText, type CsvHeader } from '@/lib/csv'
import { ContabilidadSubNav } from '../ContabilidadSubNav'
import type { BranchOption } from '../types'

type IncomeStatementLine = {
  account_id: string
  code: string
  name: string
  amount: string
}

type IncomeStatementSection = {
  key: string
  label: string
  rows: IncomeStatementLine[]
  total: string
}

type IncomeStatement = {
  sections: IncomeStatementSection[]
  total_ingresos: string
  total_costo: string
  resultado_bruto: string
  total_gastos: string
  resultado_neto: string
}

function exportCsv(data: IncomeStatement) {
  const headers: CsvHeader[] = [
    { key: 'seccion', label: 'Sección' },
    { key: 'codigo', label: 'Código' },
    { key: 'cuenta', label: 'Cuenta' },
    { key: 'importe', label: 'Importe' },
  ]
  const csvRows: Record<string, unknown>[] = data.sections.flatMap(section => [
    ...section.rows.map(row => ({
      seccion: section.label,
      codigo: row.code,
      cuenta: row.name,
      importe: row.amount,
    })),
    ...(section.rows.length > 0
      ? [{ seccion: section.label, codigo: '', cuenta: `Total ${section.label}`, importe: section.total }]
      : []),
  ])
  csvRows.push(
    { seccion: 'Resultado', codigo: '', cuenta: 'Resultado bruto', importe: data.resultado_bruto },
    { seccion: 'Resultado', codigo: '', cuenta: 'Resultado neto', importe: data.resultado_neto },
  )
  const csv = toCsvText(csvRows, headers)
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `estado-de-resultados-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function EstadoDeResultadosClient() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [branchId, setBranchId] = useState('')
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [data, setData] = useState<IncomeStatement | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchJson<{ data: BranchOption[] }>('/api/v1/branches')
        setBranches(res.data)
      } catch {
        setBranches([])
      }
    })()
  }, [])

  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (branchId) params.set('branch_id', branchId)
    ;(async () => {
      setServerError(null)
      try {
        const res = await fetchJson<IncomeStatement>(`/api/v1/accounting/reports/income-statement?${params}`)
        if (!mounted) return
        setData(res)
      } catch (e) {
        if (!mounted) return
        setServerError(getApiErrorMessage(e))
        setData(null)
      }
    })()
    return () => { mounted = false }
  }, [from, to, branchId])

  const hasRows = data ? data.sections.some(s => s.rows.length > 0) : false
  const resultadoNegativo = data ? parseFloat(data.resultado_neto) < 0 : false

  return (
    <div className="flex flex-col h-full">
      <TopBar breadcrumbs={[{ label: 'Contabilidad', href: '/contabilidad/asientos' }, { label: 'Estado de resultados' }]} />
      <ContabilidadSubNav />

      <PageBody>
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-fg-muted">Desde</label>
            <Input
              type="date"
              data-testid="income-statement-from"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-fg-muted">Hasta</label>
            <Input
              type="date"
              data-testid="income-statement-to"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-fg-muted">Sucursal</label>
            <select
              value={branchId}
              onChange={e => setBranchId(e.target.value)}
              className="h-8 rounded-sm border border-border-strong px-2 text-[13px] bg-surface focus:outline-none focus:border-ring"
              disabled={branches.length === 0}
            >
              <option value="">Todas</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{String(b.branch_code).padStart(2, '0')} — {b.name}</option>
              ))}
            </select>
          </div>
          <div className="ml-auto">
            <Button variant="secondary" size="sm" disabled={!hasRows} onClick={() => data && exportCsv(data)}>
              Exportar CSV
            </Button>
          </div>
        </div>

        {serverError && (
          <div className="mb-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">{serverError}</div>
        )}

        {data && hasRows && (
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded border border-border bg-surface-muted p-3">
              <p className="text-[12px] text-fg-muted">Ingresos</p>
              <p data-testid="total-ingresos" className="tabular-nums text-[16px] font-semibold text-fg">
                {formatARS(data.total_ingresos)}
              </p>
            </div>
            <div className="rounded border border-border bg-surface-muted p-3">
              <p className="text-[12px] text-fg-muted">Resultado bruto</p>
              <p data-testid="resultado-bruto" className="tabular-nums text-[16px] font-semibold text-fg">
                {formatARS(data.resultado_bruto)}
              </p>
            </div>
            <div className="rounded border border-border bg-surface-muted p-3">
              <p className="text-[12px] text-fg-muted">Resultado neto</p>
              <p
                data-testid="resultado-neto"
                className={`tabular-nums text-[16px] font-semibold ${resultadoNegativo ? 'text-danger' : 'text-success'}`}
              >
                {formatARS(data.resultado_neto)}
              </p>
            </div>
          </div>
        )}

        <div className="border border-border rounded-sm overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-surface-muted text-fg-muted">
              <tr>
                <th className="text-left font-medium px-3 py-2">Código</th>
                <th className="text-left font-medium px-3 py-2">Cuenta</th>
                <th className="text-right font-medium px-3 py-2">Importe</th>
              </tr>
            </thead>
            <tbody>
              {data && !hasRows && (
                <tr><td colSpan={3} className="px-3 py-8 text-center text-fg-subtle">No hay cuentas de resultado con movimientos en el período.</td></tr>
              )}
              {data?.sections.filter(section => section.rows.length > 0).map(section => (
                <Fragment key={section.key}>
                  <tr className="border-t border-border bg-surface-muted/60">
                    <td className="px-3 py-1.5 font-medium text-fg" colSpan={3}>{section.label}</td>
                  </tr>
                  {section.rows.map(row => (
                    <tr key={row.account_id} className="border-t border-border">
                      <td className="px-3 py-1.5 font-mono text-[12px] text-fg-muted">{row.code}</td>
                      <td className="px-3 py-1.5 text-fg">{row.name}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-fg-muted">{formatARS(row.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-border">
                    <td className="px-3 py-1.5 text-fg-muted" colSpan={2}>Total {section.label}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-medium text-fg">{formatARS(section.total)}</td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
            {data && hasRows && (
              <tfoot className="bg-surface-muted border-t border-border font-medium">
                <tr>
                  <td className="px-3 py-2 text-fg-muted" colSpan={2}>Resultado bruto</td>
                  <td className="px-3 py-2 text-right font-mono text-fg">{formatARS(data.resultado_bruto)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-fg-muted" colSpan={2}>Resultado neto del período</td>
                  <td className={`px-3 py-2 text-right font-mono ${resultadoNegativo ? 'text-danger' : 'text-success'}`}>
                    {formatARS(data.resultado_neto)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </PageBody>
    </div>
  )
}
