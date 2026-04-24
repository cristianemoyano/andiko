'use client'

import { useState, useEffect } from 'react'
import { Dialog } from '@/components/primitives/Dialog'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { Textarea } from '@/components/primitives/Textarea'
import { Button } from '@/components/primitives/Button'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'

type Warehouse = {
  id: string
  name: string
  description: string | null
  branch_id: string | null
  is_active: boolean
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
  const [errors, setErrors]           = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting]   = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional form reset when warehouse prop changes
    setName(warehouse?.name ?? '')
    setDescription(warehouse?.description ?? '')
    setErrors({})
    setServerError(null)
  }, [warehouse])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'El nombre es requerido'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSubmitting(true)
    setServerError(null)
    try {
      const url    = isEdit ? `/api/v1/inventory/warehouses/${warehouse.id}` : '/api/v1/inventory/warehouses'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      })
      if (!res.ok) {
        const data = await res.json()
        setServerError(data.error ?? 'Error al guardar el depósito')
        return
      }
      onSaved()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    const res = await fetch(`/api/v1/inventory/warehouses/${warehouse!.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      setServerError(data.error ?? 'Error al eliminar')
      setConfirmDelete(false)
      return
    }
    onSaved()
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

          {serverError && (
            <p className="text-red-600 text-sm">{serverError}</p>
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
