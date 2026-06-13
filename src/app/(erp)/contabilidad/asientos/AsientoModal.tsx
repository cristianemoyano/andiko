'use client'

import { useState, useEffect } from 'react'
import { Dialog } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { FormField } from '@/components/primitives/FormField'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { cn } from '@/lib/utils'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import type { Account, BranchOption, JournalEntry } from '../types'

interface AsientoModalProps {
  open: boolean
  entry: JournalEntry | null
  onOpenChange: (open: boolean) => void
  onSaved: (entryId: string) => void
}

type LineRow = {
  account_id: string
  branch_id: string
  description: string
  debit: string
  credit: string
}

function emptyLine(): LineRow {
  return { account_id: '', branch_id: '', description: '', debit: '', credit: '' }
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function sum(rows: LineRow[], key: 'debit' | 'credit'): number {
  return rows.reduce((acc, r) => acc + (parseFloat(r[key]) || 0), 0)
}

function initialLinesFromEntry(entry: JournalEntry | null): LineRow[] {
  if (!entry) return [emptyLine(), emptyLine()]
  return entry.lines.map(l => ({
    account_id: l.account_id,
    branch_id: l.branch_id ?? '',
    description: l.description ?? '',
    debit: parseFloat(l.debit) > 0 ? l.debit : '',
    credit: parseFloat(l.credit) > 0 ? l.credit : '',
  }))
}

export function AsientoModal({ open, entry, onOpenChange, onSaved }: AsientoModalProps) {
  const isEdit = entry !== null
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? `Editar asiento ${entry.entry_number}` : 'Nuevo asiento'}
      size="xl"
    >
      {open ? (
        <AsientoModalForm
          key={entry?.id ?? 'new'}
          entry={entry}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      ) : null}
    </Dialog>
  )
}

function AsientoModalForm({
  entry,
  onOpenChange,
  onSaved,
}: {
  entry: JournalEntry | null
  onOpenChange: (open: boolean) => void
  onSaved: (entryId: string) => void
}) {
  const isEdit = entry !== null
  const [accounts, setAccounts] = useState<Account[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [entryDate, setEntryDate] = useState(() => entry?.entry_date ?? todayISO())
  const [description, setDescription] = useState(() => entry?.description ?? '')
  const [lines, setLines] = useState<LineRow[]>(() => initialLinesFromEntry(entry))
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const data = await fetchJson<{ data: Account[] }>('/api/v1/accounting/accounts?all=true&is_postable=true')
        if (mounted) setAccounts(data.data.filter(a => a.is_active))
      } catch {
        if (mounted) setAccounts([])
      }
      try {
        const data = await fetchJson<{ data: BranchOption[] }>('/api/v1/branches')
        if (mounted) setBranches(data.data)
      } catch {
        if (mounted) setBranches([])
      }
    })()
    return () => { mounted = false }
  }, [])

  function updateLine(idx: number, patch: Partial<LineRow>) {
    setLines(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  function removeLine(idx: number) {
    setLines(prev => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== idx)))
  }

  const totalDebit = sum(lines, 'debit')
  const totalCredit = sum(lines, 'credit')
  const difference = Math.round((totalDebit - totalCredit) * 100) / 100
  const balanced = difference === 0 && totalDebit > 0

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setServerError(null)

    const payloadLines = lines
      .filter(l => l.account_id && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
      .map((l, idx) => ({
        account_id: l.account_id,
        branch_id: l.branch_id || null,
        description: l.description.trim() || null,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
        sort_order: idx,
      }))

    const body = { entry_date: entryDate, description: description.trim() || null, lines: payloadLines }
    const url = isEdit ? `/api/v1/accounting/journal-entries/${entry.id}` : '/api/v1/accounting/journal-entries'
    const method = isEdit ? 'PATCH' : 'POST'

    try {
      const saved = await fetchJson<{ id: string }>(url, { method, body: JSON.stringify(body) })
      onSaved(saved.id)
    } catch (err) {
      setServerError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="px-5 py-4 flex flex-col gap-4 max-h-[70vh] overflow-auto">
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Fecha" htmlFor="entry_date" required>
            <Input id="entry_date" type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} disabled={saving} required />
          </FormField>
          <FormField label="Descripción" htmlFor="description" className="col-span-2">
            <Input id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Glosa del asiento" disabled={saving} />
          </FormField>
        </div>

        <div className="border border-zinc-200 rounded-sm overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="text-left font-medium px-2 py-1.5 w-[34%]">Cuenta</th>
                <th className="text-left font-medium px-2 py-1.5 w-[18%]">Sucursal</th>
                <th className="text-left font-medium px-2 py-1.5">Detalle</th>
                <th className="text-right font-medium px-2 py-1.5 w-[14%]">Debe</th>
                <th className="text-right font-medium px-2 py-1.5 w-[14%]">Haber</th>
                <th className="px-2 py-1.5 w-[36px]" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className="border-t border-zinc-100">
                  <td className="px-2 py-1">
                    <select
                      value={line.account_id}
                      onChange={e => updateLine(idx, { account_id: e.target.value })}
                      className="h-8 w-full rounded-sm border border-zinc-300 px-2 text-[12px] bg-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="">— Elegir cuenta —</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <select
                      value={line.branch_id}
                      onChange={e => updateLine(idx, { branch_id: e.target.value })}
                      className="h-8 w-full rounded-sm border border-zinc-300 px-2 text-[12px] bg-white focus:outline-none focus:border-blue-500"
                      disabled={branches.length === 0}
                    >
                      <option value="">— Sin sucursal —</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{String(b.branch_code).padStart(2, '0')} — {b.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <Input value={line.description} onChange={e => updateLine(idx, { description: e.target.value })} placeholder="Opcional" disabled={saving} />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      className="text-right"
                      value={line.debit}
                      onChange={e => updateLine(idx, { debit: e.target.value, credit: e.target.value ? '' : line.credit })}
                      disabled={saving}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      className="text-right"
                      value={line.credit}
                      onChange={e => updateLine(idx, { credit: e.target.value, debit: e.target.value ? '' : line.debit })}
                      disabled={saving}
                    />
                  </td>
                  <td className="px-1 py-1 text-center">
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      disabled={lines.length <= 2}
                      className="text-zinc-400 hover:text-red-600 disabled:opacity-30 disabled:hover:text-zinc-400"
                      aria-label="Quitar línea"
                    >
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13"/></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-zinc-50 border-t border-zinc-200 font-medium">
              <tr>
                <td className="px-2 py-1.5 text-zinc-600" colSpan={3}>Totales</td>
                <td className="px-2 py-1.5 text-right font-mono text-zinc-800">{formatARS(totalDebit)}</td>
                <td className="px-2 py-1.5 text-right font-mono text-zinc-800">{formatARS(totalCredit)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex items-center justify-between">
          <Button type="button" variant="secondary" size="xs" onClick={() => setLines(prev => [...prev, emptyLine()])} disabled={saving}>
            + Agregar línea
          </Button>
          <span className={cn('text-[12px] font-medium px-2 py-1 rounded-sm', balanced ? 'text-green-700 bg-green-50' : 'text-amber-700 bg-amber-50')}>
            {balanced ? 'Asiento balanceado' : `Diferencia: ${formatARS(Math.abs(difference))}`}
          </span>
        </div>

        {serverError && (
          <p role="alert" className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
            {serverError}
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-200 bg-zinc-50">
        <Button type="button" variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={saving || !balanced}>
          {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear asiento'}
        </Button>
      </div>
    </form>
  )
}
