'use client'

import { useState, useEffect } from 'react'
import { Dialog } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { ConfirmDialog } from '@/components/erp'

interface PosDevice {
  id: string
  device_id: string
  name: string | null
  license_valid_until: string | null
  is_active: boolean
  punto_venta: number | null
}

interface Props {
  device: PosDevice | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function DeviceEditModal({ device, onOpenChange, onSaved }: Props) {
  const open = device !== null
  const [licenseDate, setLicenseDate] = useState('')
  const [clearLicense, setClearLicense] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [puntoVenta, setPuntoVenta] = useState('')
  const [clearPuntoVenta, setClearPuntoVenta] = useState(true)
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState('')
  const [regenOpen, setRegenOpen] = useState(false)
  const [regeneratedToken, setRegeneratedToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (device) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing form fields from prop change is a valid derived-state pattern
      setLicenseDate(device.license_valid_until ? device.license_valid_until.slice(0, 10) : '')
      setClearLicense(!device.license_valid_until)
      setIsActive(device.is_active)
      setPuntoVenta(device.punto_venta != null ? String(device.punto_venta) : '')
      setClearPuntoVenta(device.punto_venta == null)
      setServerError('')
      setRegeneratedToken(null)
      setCopied(false)
    }
  }, [device])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!device) return
    setLoading(true)
    setServerError('')
    try {
      const license_valid_until = clearLicense
        ? null
        : licenseDate
          ? new Date(licenseDate).toISOString()
          : undefined

      await fetchJson(`/api/v1/pos/devices/${device.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_valid_until,
          is_active: isActive,
          punto_venta: clearPuntoVenta
            ? null
            : puntoVenta.trim()
              ? Number(puntoVenta.trim())
              : undefined,
        }),
      })
      onSaved()
      onOpenChange(false)
    } catch (err) {
      setServerError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleRegenerateToken() {
    if (!device) return
    setLoading(true)
    setServerError('')
    try {
      const res = await fetchJson<{ ok: boolean; api_token: string }>(
        `/api/v1/pos/devices/${device.id}/regenerate-token`,
        { method: 'POST' },
      )
      setRegeneratedToken(res.api_token)
      setCopied(false)
      onSaved()
      setRegenOpen(false)
    } catch (err) {
      setServerError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!regeneratedToken) return
    await navigator.clipboard.writeText(regeneratedToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function handleClose() {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose} title="Editar dispositivo" size="sm">
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        {serverError && (
          <p className="text-sm text-danger bg-danger-bg border border-danger rounded px-3 py-2">{serverError}</p>
        )}

        <div>
          <p className="text-xs text-fg-muted">Device ID</p>
          <p className="text-sm font-mono text-fg mt-0.5">{device?.device_id}</p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-fg-muted">Estado</p>
            <p className="text-xs text-fg-muted mt-0.5">
              Si está inactivo, el POS no debería poder validar licencia ni operar.
            </p>
          </div>
          <label className="flex items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded"
            />
            <span className="text-xs text-fg-muted">{isActive ? 'Activo' : 'Inactivo'}</span>
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-fg-muted">Punto de venta fiscal</label>
          <input
            type="text"
            inputMode="numeric"
            value={clearPuntoVenta ? '' : puntoVenta}
            onChange={e => {
              setPuntoVenta(e.target.value.replace(/\D/g, ''))
              setClearPuntoVenta(false)
            }}
            disabled={clearPuntoVenta}
            placeholder="Ej: 3"
            className="border border-border-strong rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-surface-muted disabled:text-fg-subtle"
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={clearPuntoVenta}
              onChange={e => setClearPuntoVenta(e.target.checked)}
              className="rounded"
            />
            <span className="text-xs text-fg-muted">Usar el PV de la sucursal (sin override)</span>
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-fg-muted">Licencia válida hasta</label>
          <input
            type="date"
            value={clearLicense ? '' : licenseDate}
            onChange={e => { setLicenseDate(e.target.value); setClearLicense(false) }}
            disabled={clearLicense}
            className="border border-border-strong rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-surface-muted disabled:text-fg-subtle"
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={clearLicense}
              onChange={e => setClearLicense(e.target.checked)}
              className="rounded"
            />
            <span className="text-xs text-fg-muted">Sin fecha de licencia (bloquea el POS)</span>
          </label>
        </div>

        <div className="border-t border-border pt-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-fg-muted">Token del dispositivo</p>
              <p className="text-xs text-fg-muted mt-0.5">
                Regenerar el token puede cortar la conexión del POS si está activo.
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={() => setRegenOpen(true)} disabled={loading}>
              Regenerar token
            </Button>
          </div>

          {regeneratedToken && (
            <div className="p-3 bg-warning-bg border border-warning rounded-md space-y-2">
              <p className="text-xs font-medium text-warning">
                Token regenerado. Copialo y actualizalo en el POS. No se vuelve a mostrar.
              </p>
              <div className="flex items-start gap-2 min-w-0">
                <code className="flex-1 min-w-0 block text-xs font-mono bg-surface border border-warning rounded px-3 py-2 text-warning overflow-x-auto whitespace-nowrap">
                  {regeneratedToken}
                </code>
                <Button type="button" size="sm" variant="secondary" onClick={handleCopy} className="flex-shrink-0 mt-0.5">
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Guardando…' : 'Guardar'}</Button>
        </div>
      </form>

      <ConfirmDialog
        open={regenOpen}
        onOpenChange={setRegenOpen}
        title="Regenerar token del dispositivo"
        description="Esto invalida el token actual. Si el POS está configurado con el token viejo, puede quedar desconectado hasta que lo actualices."
        variant="danger"
        confirmLabel="Regenerar"
        onConfirm={handleRegenerateToken}
      />
    </Dialog>
  )
}
