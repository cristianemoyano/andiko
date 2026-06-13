'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Input } from '@/components/primitives/Input'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { ContabilidadSubNav } from '../ContabilidadSubNav'
import type { BranchOption } from '../types'

type TrialBalanceRow = {
  account_id: string
  code: string
  name: string
  type: string
  total_debit: string
  total_credit: string
  saldo_debit: string
  saldo_credit: string
}

type TrialBalance = {
  rows: TrialBalanceRow[]
  totals: { total_debit: string; total_credit: string; saldo_debit: string; saldo_credit: string }
}

export function BalanceClient() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [branchId, setBranchId] = useState('')
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [data, setData] = useState<TrialBalance | null>(null)
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
        const res = await fetchJson<TrialBalance>(`/api/v1/accounting/reports/trial-balance?${params}`)
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

  return (
    <div className="flex flex-col h-full">
      <TopBar breadcrumbs={[{ label: 'Contabilidad', href: '/contabilidad/asientos' }, { label: 'Balance de sumas y saldos' }]} />
      <ContabilidadSubNav />

      <div className="flex-1 p-5 overflow-auto">
        <div className="flex items-end gap-3 mb-4">
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-zinc-600">Desde</label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-zinc-600">Hasta</label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-zinc-600">Sucursal</label>
            <select
              value={branchId}
              onChange={e => setBranchId(e.target.value)}
              className="h-8 rounded-sm border border-zinc-300 px-2 text-[13px] bg-white focus:outline-none focus:border-blue-500"
              disabled={branches.length === 0}
            >
              <option value="">Todas</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{String(b.branch_code).padStart(2, '0')} — {b.name}</option>
              ))}
            </select>
          </div>
        </div>

        {serverError && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{serverError}</div>
        )}

        <div className="border border-zinc-200 rounded-sm overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="text-left font-medium px-3 py-2">Código</th>
                <th className="text-left font-medium px-3 py-2">Cuenta</th>
                <th className="text-right font-medium px-3 py-2">Sumas Debe</th>
                <th className="text-right font-medium px-3 py-2">Sumas Haber</th>
                <th className="text-right font-medium px-3 py-2">Saldo Deudor</th>
                <th className="text-right font-medium px-3 py-2">Saldo Acreedor</th>
              </tr>
            </thead>
            <tbody>
              {data && data.rows.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-zinc-400">No hay movimientos contabilizados en el período.</td></tr>
              )}
              {data?.rows.map(row => (
                <tr key={row.account_id} className="border-t border-zinc-100">
                  <td className="px-3 py-1.5 font-mono text-[12px] text-zinc-500">{row.code}</td>
                  <td className="px-3 py-1.5 text-zinc-800">{row.name}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-zinc-700">{formatARS(row.total_debit)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-zinc-700">{formatARS(row.total_credit)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-zinc-700">{parseFloat(row.saldo_debit) > 0 ? formatARS(row.saldo_debit) : ''}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-zinc-700">{parseFloat(row.saldo_credit) > 0 ? formatARS(row.saldo_credit) : ''}</td>
                </tr>
              ))}
            </tbody>
            {data && data.rows.length > 0 && (
              <tfoot className="bg-zinc-50 border-t border-zinc-200 font-medium">
                <tr>
                  <td className="px-3 py-2 text-zinc-600" colSpan={2}>Totales</td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-900">{formatARS(data.totals.total_debit)}</td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-900">{formatARS(data.totals.total_credit)}</td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-900">{formatARS(data.totals.saldo_debit)}</td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-900">{formatARS(data.totals.saldo_credit)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
