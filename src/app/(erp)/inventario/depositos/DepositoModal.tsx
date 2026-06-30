'use client'

import { useState, useEffect } from 'react'
import { Dialog } from '@/components/primitives/Dialog'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { Textarea } from '@/components/primitives/Textarea'
import { Button } from '@/components/primitives/Button'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

type Warehouse = {
  id: string
  name: string
  description: string | null
  branch_id: string | null
  is_active: boolean
  default_minimum_quantity?: string
}

interface DepositoModalProps {
  warehouse: Warehouse | null
  onClose: () => void
  onSaved: () => void
}

export function DepositoModal({ warehouse, onClose, onSaved }: DepositoModalProps) {
  const isEdit = !!warehouse

  const [name, setName]               = useState(warehouse?.name ?? '')
  const [description, setDescription] = useState(warehouse?.description ?? '')
  const [defaultMinimum, setDefaultMinimum] = useState(warehouse?.default_minimum_quantity ?? '0')
  const [errors, setErrors]           = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting]   = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional form reset when warehouse prop changes
    setName(warehouse?.name ?? '')
    setDescription(warehouse?.description ?? '')
    setDefaultMinimum(warehouse?.default_minimum_quantity ?? '0')
    setErrors({})
    setServerError(null)
  }, [warehouse])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'El nombre es requerido'
    const minN = Number(defaultMinimum)
    if (!Number.isFinite(minN) || minN < 0) errs.default_minimum = 'Ingresá un mínimo válido ≥ 0'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSubmitting(true)
    setServerError(null)
    try {
      const url    = isEdit ? `/api/v1/inventory/warehouses/${warehouse.id}` : '/api/v1/inventory/warehouses'
      const method = isEdit ? 'PATCH' : 'POST'
      await fetchJson(url, {
        method,
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          default_minimum_quantity: Number(defaultMinimum),
        }),
      })
      onSaved()
    } catch (e) {
      setServerError(getApiErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    try {
      await fetchJson(`/api/v1/inventory/warehouses/${warehouse!.id}`, { method: 'DELETE' })
      setConfirmDelete(false)
      onSaved()
    } catch (e) {
      setServerError(getApiErrorMessage(e))
      setConfirmDelete(false)
    }
  }

  return (
    <>
      <Dialog
        open
        onOpenChange={open => { if (!open) onClose() }}
        title={isEdit ? 'Editar depósito' : 'Nuevo depósito'}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField label="Nombre" error={errors.name} required>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Depósito principal"
            />
          </FormField>

          <FormField label="Descripción" error={errors.description}>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Descripción opcional"
              rows={2}
            />
          </FormField>

          <FormField label="Stock mínimo default" error={errors.default_minimum}>
            <Input
              type="number"
              min={0}
              step="0.0001"
              value={defaultMinimum}
              onChange={e => setDefaultMinimum(e.target.value)}
              placeholder="0"
            />
            <p className="text-[11px] text-fg-subtle mt-1">
              Se asigna a productos nuevos en este depósito. Aplicá en masa desde el detalle del depósito.
            </p>
          </FormField>

          {serverError && (
            <p className="text-danger text-sm">{serverError}</p>
          )}

          <div className="flex justify-between gap-2 pt-1">
            {isEdit && (
              <Button type="button" variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                Eliminar
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Eliminar depósito"
        description={`¿Estás seguro de que querés eliminar "${warehouse?.name}"?`}
        variant="danger"
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
      />
    </>
  )
}
