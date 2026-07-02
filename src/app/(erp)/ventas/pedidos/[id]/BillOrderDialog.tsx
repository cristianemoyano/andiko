'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogFooter } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { CurrencyInput } from '@/components/primitives/CurrencyInput'
import { DatePicker } from '@/components/primitives/DatePicker'
import { fetchJson, getApiErrorMessage, isApiRequestError } from '@/lib/fetch-json'
import {
  ORDER_BILL_MODES,
  ORDER_BILL_MODE_LABEL,
  type OrderBillMode,
} from '@/modules/sales/order-bill.schema'
import { suggestedOrderBillMode } from '@/modules/sales/sales-config.schema'
import { PAYMENT_CONDITION_LABEL, type Order } from '../../types'

const PAYMENT_METHOD_OPTIONS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'check', label: 'Cheque' },
  { value: 'other', label: 'Otro' },
] as const

export interface BillOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: Order
  onBilled?: () => void
}

export function BillOrderDialog({ open, onOpenChange, order, onBilled }: BillOrderDialogProps) {
  const router = useRouter()
  const [mode, setMode] = useState<OrderBillMode>('issue')
  const [paymentMethod, setPaymentMethod] = useState<string>('cash')
  const [paymentAmount, setPaymentAmount] = useState(order.total)
  const [paymentDate, setPaymentDate] = useState<Date | null>(new Date())
  const [paymentRef, setPaymentRef] = useState('')
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setMode(suggestedOrderBillMode(order.payment_condition))
      setPaymentMethod('cash')
      setPaymentAmount(order.total)
      setPaymentDate(new Date())
      setPaymentRef('')
      setServerError(null)
    })
  }, [open, order.payment_condition, order.total])

  async function handleSubmit() {
    setSaving(true)
    setServerError(null)
    try {
      const body: Record<string, unknown> = { mode }
      if (mode === 'issue_and_collect') {
        body.payment = {
          amount: parseFloat(paymentAmount) || parseFloat(order.total),
          payment_method: paymentMethod,
          ...(paymentDate ? { payment_date: paymentDate.toISOString() } : {}),
          ...(paymentRef.trim() ? { reference: paymentRef.trim() } : {}),
        }
      }
      const invoice = await fetchJson<{ id: string }>(`/api/v1/sales/orders/${order.id}/bill`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      onOpenChange(false)
      onBilled?.()
      router.push(`/ventas/facturas/${invoice.id}`)
    } catch (e) {
      if (isApiRequestError(e) && e.code === 'ORDER_ALREADY_INVOICED') {
        const invoiceId = (e.details as { invoice_id?: string } | undefined)?.invoice_id
        if (invoiceId) {
          onOpenChange(false)
          router.push(`/ventas/facturas/${invoiceId}`)
          return
        }
      }
      setServerError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Facturar pedido"
      description={`Pedido ${order.order_number} · ${PAYMENT_CONDITION_LABEL[order.payment_condition]}. Elegí cómo registrar la factura y el cobro según tu operación.`}
      size="md"
      footer={
        <DialogFooter error={serverError}>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Procesando…' : ORDER_BILL_MODE_LABEL[mode]}
          </Button>
        </DialogFooter>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="rounded-sm border border-border bg-surface-2 px-3 py-2 text-[12px] text-fg-muted">
          La factura y el cobro son independientes del envío y la entrega. Podés cobrar antes, facturar a cuenta o registrar el cobro contra entrega cuando ya lo recibiste.
        </p>

        <FormField label="¿Cómo querés facturar?" htmlFor="bill_mode">
          <Select
            id="bill_mode"
            value={mode}
            onChange={v => setMode(v as OrderBillMode)}
            options={ORDER_BILL_MODES.map(m => ({ value: m, label: ORDER_BILL_MODE_LABEL[m] }))}
          />
        </FormField>

        {mode === 'issue_and_collect' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-sm border border-border p-3">
            <FormField label="Importe cobrado" htmlFor="bill_amount" className="sm:col-span-2">
              <CurrencyInput
                id="bill_amount"
                value={paymentAmount}
                onChange={setPaymentAmount}
              />
            </FormField>
            <FormField label="Medio de pago" htmlFor="bill_method">
              <Select
                id="bill_method"
                value={paymentMethod}
                onChange={setPaymentMethod}
                options={PAYMENT_METHOD_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
              />
            </FormField>
            <FormField label="Fecha del cobro" htmlFor="bill_pay_date">
              <DatePicker id="bill_pay_date" value={paymentDate} onChange={setPaymentDate} placeholder="Hoy" />
            </FormField>
            <FormField label="Referencia (opcional)" htmlFor="bill_ref" className="sm:col-span-2">
              <Input
                id="bill_ref"
                value={paymentRef}
                onChange={e => setPaymentRef(e.target.value)}
                placeholder="N° transferencia, voucher…"
              />
            </FormField>
          </div>
        )}
      </div>
    </Dialog>
  )
}
