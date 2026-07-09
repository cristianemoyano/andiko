'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogFooter } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import type { DeliveryLogisticsMode } from '@/modules/sales/sales-order.schema'

export interface MarkDeliveredDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderNumber: string
  activeShipmentCount: number
  onConfirm: (mode: DeliveryLogisticsMode) => Promise<void>
  onCreateShipment?: () => void
}

export function MarkDeliveredDialog({
  open,
  onOpenChange,
  orderNumber,
  activeShipmentCount,
  onConfirm,
  onCreateShipment,
}: MarkDeliveredDialogProps) {
  const hasOpenShipments = activeShipmentCount > 0
  const [mode, setMode] = useState<DeliveryLogisticsMode>(
    hasOpenShipments ? 'close_open_shipments' : 'none',
  )
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setMode(hasOpenShipments ? 'close_open_shipments' : 'none')
      setServerError(null)
    })
  }, [open, hasOpenShipments])

  async function handleSubmit() {
    setSaving(true)
    setServerError(null)
    try {
      await onConfirm(mode)
      onOpenChange(false)
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'No se pudo marcar como entregado')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Marcar como entregado"
      description={`Pedido ${orderNumber}`}
    >
      <div className="space-y-4">
        {hasOpenShipments ? (
          <p className="text-[13px] text-fg-muted">
            Este pedido tiene {activeShipmentCount} envío{activeShipmentCount !== 1 ? 's' : ''} abierto
            . Al confirmar se marcarán como entregados en logística.
          </p>
        ) : (
          <>
            <p className="text-[13px] text-fg-muted">
              ¿Cómo se entregó la mercadería al cliente?
            </p>
            <fieldset className="space-y-2">
              <label className="flex items-start gap-2.5 rounded-sm border border-border px-3 py-2.5 cursor-pointer has-[:checked]:border-brand-accent has-[:checked]:bg-brand-accent-bg/50">
                <input
                  type="radio"
                  name="delivery_logistics"
                  className="mt-0.5"
                  checked={mode === 'none'}
                  onChange={() => setMode('none')}
                />
                <span>
                  <span className="block text-[13px] font-medium text-fg">Retiro en sucursal / sin envío</span>
                  <span className="block text-[12px] text-fg-muted mt-0.5">
                    Venta local o el cliente retiró en mostrador. No se registra envío en logística.
                  </span>
                </span>
              </label>
              {onCreateShipment && (
                <div className="rounded-sm border border-dashed border-border px-3 py-2.5">
                  <p className="text-[12px] text-fg-muted mb-2">
                    Si despachás con courier o reparto propio, registrá el envío antes o después de marcar entregado.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    onClick={() => {
                      onOpenChange(false)
                      onCreateShipment()
                    }}
                  >
                    Generar envío primero
                  </Button>
                </div>
              )}
            </fieldset>
          </>
        )}
        {serverError && (
          <p className="text-[13px] text-danger" role="alert">{serverError}</p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancelar
        </Button>
        <Button type="button" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? 'Guardando…' : 'Marcar entregado'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
