import { z } from 'zod'

export const posSaleItemInputSchema = z.object({
  variant_id: z.string().uuid().optional(),
  description: z.string().default('Producto POS'),
  qty: z.number().positive(),
  unit_price: z.string().regex(/^\d+(\.\d{1,4})?$/),
  iva_rate: z.enum(['0', '10.5', '21', '27']).default('21'),
})

export const posSalePaymentInputSchema = z.object({
  payment_method_id: z.string().uuid(),
  payment_method_name: z.string().min(1).max(128),
  payment_method_type: z.string().min(1).max(64),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  reference: z.string().max(255).nullable().optional(),
})

export const posSaleAuthorizeSchema = z.object({
  pos_sale_id: z.string().min(1),
  customer_id: z.string().uuid().optional(),
  cashier_user_id: z.string().uuid().optional(),
  cashier_name: z.string().min(1).max(120).optional(),
  payments: z.array(posSalePaymentInputSchema).min(1),
  sold_at: z.string().datetime({ offset: true }),
  items: z.array(posSaleItemInputSchema).min(1),
})

export type PosSaleAuthorizeInput = z.infer<typeof posSaleAuthorizeSchema>
