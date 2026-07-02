import { z } from 'zod'
import { PAYMENT_METHODS, type PaymentMethod } from './payment.constants'

const paymentMethodEnum = z.enum([...PAYMENT_METHODS] as [PaymentMethod, ...PaymentMethod[]])

/** Cómo cerrar la parte fiscal/cobro de un pedido — pasos independientes de envío y entrega. */
export const ORDER_BILL_MODES = ['draft', 'issue', 'issue_and_collect'] as const
export type OrderBillMode = typeof ORDER_BILL_MODES[number]

export const ORDER_BILL_MODE_LABEL: Record<OrderBillMode, string> = {
  draft:               'Crear borrador de factura',
  issue:               'Emitir factura (cobrar después)',
  issue_and_collect:   'Cobrar y emitir factura',
}

export const orderBillPaymentSchema = z.object({
  amount:         z.coerce.number().positive().optional(),
  payment_method: paymentMethodEnum,
  payment_date:   z.string().datetime({ offset: true }).transform(s => new Date(s)).optional(),
  reference:      z.string().max(255).nullable().optional(),
  notes:          z.string().nullable().optional(),
})

export const orderBillSchema = z.object({
  mode:    z.enum(ORDER_BILL_MODES).default('draft'),
  payment: orderBillPaymentSchema.optional(),
}).superRefine((value, ctx) => {
  if (value.mode === 'issue_and_collect' && !value.payment) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Indicá el cobro para emitir y registrar el pago',
      path: ['payment'],
    })
  }
})

export type OrderBillInput = z.infer<typeof orderBillSchema>
export type OrderBillPaymentInput = z.infer<typeof orderBillPaymentSchema>
