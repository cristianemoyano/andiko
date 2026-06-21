'use client'

import { useState } from 'react'
import { Dialog } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { BranchSelectField } from '@/components/erp/BranchSelectField'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

interface CreatedDevice {
  id: string
  device_id: string
  name: string | null
  api_token: string
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function DeviceModal({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [branchId, setBranchId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')
  const [created, setCreated] = useState<CreatedDevice | null>(null)
  const [copied, setCopied] = useState(false)

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setName(val)
    setDeviceId(slugify(val))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fieldErrors: Record<string, string> = {}
    if (!name.trim()) fieldErrors.name = 'Requerido'
    if (!deviceId.trim()) fieldErrors.device_id = 'El Device ID no puede estar vacío'
    if (Object.keys(fieldErrors).length) { setErrors(fieldErrors); return }

    setLoading(true)
    setErrors({})
    setServerError('')

    try {
      const res = await fetchJson<CreatedDevice>('/api/v1/pos/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId.trim(),
          name: name.trim(),
          branch_id: branchId ?? undefined,
        }),
      })
      setCreated(res)
    } catch (err) {
      setServerError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    if (created) onCreated()
    setCreated(null)
    setCopied(false)
    setName('')
    setDeviceId('')
    setBranchId(null)
    setErrors({})
    setServerError('')
    onOpenChange(false)
  }

  async function handleCopy() {
    if (!created) return
    await navigator.clipboard.writeText(created.api_token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose} title="Registrar dispositivo POS" size="md">
      {created ? (
        <div className="flex flex-col gap-4 w-full min-w-0 overflow-hidden">
          <div className="flex items-start gap-3 p-3 bg-success-bg border border-success rounded-md">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" className="mt-0.5 flex-shrink-0">
              <path d="M3 8l3.5 3.5L13 4"/>
            </svg>
            <div>
              <p className="text-sm font-medium text-success">Dispositivo registrado</p>
              <p className="text-xs text-success mt-0.5">Copiá el token y configuralo en el POS. No se puede ver de nuevo.</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-fg-muted mb-1">Device ID</p>
            <p className="text-sm font-mono text-fg">{created.device_id}</p>
          </div>

          <div>
            <p className="text-xs font-medium text-fg-muted mb-1">API Token</p>
            <div className="flex items-start gap-2 min-w-0">
              <code className="flex-1 min-w-0 block text-xs font-mono bg-surface-hover border border-border rounded px-3 py-2 text-fg overflow-x-auto whitespace-nowrap">
                {created.api_token}
              </code>
              <Button size="sm" variant="secondary" onClick={handleCopy} className="flex-shrink-0 mt-0.5">
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleClose}>Cerrar</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {serverError && (
            <p className="text-sm text-danger bg-danger-bg border border-danger rounded px-3 py-2">{serverError}</p>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-xs font-medium text-fg-muted">
              Nombre <span className="text-danger">*</span>
            </label>
            <input
              id="name"
              value={name}
              onChange={handleNameChange}
              placeholder="ej: Caja 1 — Sucursal Centro"
              className="border border-border-strong rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {errors.name && <p className="text-xs text-danger">{errors.name}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="device_id" className="text-xs font-medium text-fg-muted">Device ID</label>
            <input
              id="device_id"
              value={deviceId}
              onChange={e => setDeviceId(e.target.value)}
              placeholder="auto-generado desde el nombre"
              className="border border-border-strong rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 text-fg-muted"
            />
            {errors.device_id && <p className="text-xs text-danger">{errors.device_id}</p>}
            <p className="text-xs text-fg-subtle">Se genera automáticamente al escribir el nombre. Podés editarlo.</p>
          </div>

          <BranchSelectField
            value={branchId}
            onChange={setBranchId}
            label="Sucursal"
            autoDefaultFromSession
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Registrando…' : 'Registrar'}</Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
