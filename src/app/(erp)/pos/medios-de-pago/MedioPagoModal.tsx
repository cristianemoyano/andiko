'use client'

import { useState, useEffect } from 'react'
import { Dialog } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import type { PosPaymentMethodRow } from './MediosDePagoClient'

const TYPE_OPTIONS = [
  { value: 'cash',            label: 'Efectivo' },
  { value: 'card',            label: 'Tarjeta (débito/crédito)' },
  { value: 'transfer',        label: 'Transferencia bancaria' },
  { value: 'qr',              label: 'QR (Mercado Pago, MODO, etc.)' },
  { value: 'current_account', label: 'Cuenta corriente' },
  { value: 'check',           label: 'Cheque' },
  { value: 'other',           label: 'Otro' },
]

type Branch = { id: string; name: string }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: PosPaymentMethodRow | null
  onSaved: () => void
}

export function MedioPagoModal({ open, onOpenChange, editing, onSaved }: Props) {
  const [name, setName] = useState(() => editing?.name ?? '')
  const [type, setType] = useState(() => editing?.type ?? 'cash')
  const [requiresReference, setRequiresReference] = useState(() => editing?.requires_reference ?? false)
  const [sortOrder, setSortOrder] = useState(() => editing?.sort_order ?? 0)
  const [isActive, setIsActive] = useState(() => editing?.is_active ?? true)
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>(() => editing?.branchAssignments?.map(a => a.branch_id) ?? [])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')

  useEffect(() => {
    fetchJson<{ data: Branch[] }>('/api/v1/branches')
      .then(res => setBranches(res.data))
      .catch(() => {})
  }, [])

  function toggleBranch(id: string) {
    setSelectedBranchIds(prev =>
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fieldErrors: Record<string, string> = {}
    if (!name.trim()) fieldErrors.name = 'Requerido'
    if (Object.keys(fieldErrors).length) { setErrors(fieldErrors); return }

    setLoading(true)
    setErrors({})
    setServerError('')

    const payload = {
      name: name.trim(),
      type,
      requires_reference: requiresReference,
      sort_order: sortOrder,
      is_active: isActive,
      branch_ids: selectedBranchIds,
    }

    try {
      if (editing) {
        await fetchJson(`/api/v1/pos/org-payment-methods/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        await fetchJson('/api/v1/pos/org-payment-methods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      onSaved()
      onOpenChange(false)
    } catch (err) {
      setServerError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Editar medio de pago' : 'Nuevo medio de pago'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
        {serverError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{serverError}</p>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor="pm-name" className="text-xs font-medium text-zinc-700">
            Nombre <span className="text-red-500">*</span>
          </label>
          <input
            id="pm-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="ej: Efectivo, Tarjeta Visa, QR Mercado Pago"
            className="border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="pm-type" className="text-xs font-medium text-zinc-700">Tipo</label>
          <select
            id="pm-type"
            value={type}
            onChange={e => setType(e.target.value)}
            className="border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            {TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <p className="text-xs text-zinc-400">
            El tipo determina el comportamiento en el POS (ej: QR muestra código, Efectivo calcula vuelto).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 flex flex-col gap-1">
            <label htmlFor="pm-sort" className="text-xs font-medium text-zinc-700">Orden</label>
            <input
              id="pm-sort"
              type="number"
              min={0}
              value={sortOrder}
              onChange={e => setSortOrder(Number(e.target.value))}
              className="border border-zinc-300 rounded-md px-3 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex flex-col gap-1 pt-4">
            <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
              <input
                type="checkbox"
                checked={requiresReference}
                onChange={e => setRequiresReference(e.target.checked)}
                className="rounded"
              />
              Requiere referencia / comprobante
            </label>
            {editing && (
              <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={e => setIsActive(e.target.checked)}
                  className="rounded"
                />
                Activo
              </label>
            )}
          </div>
        </div>

        {branches.length > 0 && (
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-zinc-700">Sucursales habilitadas</label>
            <div className="border border-zinc-200 rounded-md divide-y divide-zinc-100">
              {branches.map(b => (
                <label key={b.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-zinc-50">
                  <input
                    type="checkbox"
                    checked={selectedBranchIds.includes(b.id)}
                    onChange={() => toggleBranch(b.id)}
                    className="rounded"
                  />
                  <span className="text-sm text-zinc-800">{b.name}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-zinc-400">
              Solo las sucursales seleccionadas verán este medio en su POS.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
