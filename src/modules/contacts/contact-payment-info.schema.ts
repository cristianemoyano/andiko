import { z } from 'zod'

export const contactPaymentInfoSchema = z.object({
  bank_name:    z.string().max(100).nullable().optional(),
  cbu:          z.string().regex(/^\d{22}$/, 'El CBU debe tener exactamente 22 dígitos').nullable().optional(),
  alias:        z.string().max(100).nullable().optional(),
  account_type: z.enum(['checking', 'savings']).nullable().optional(),
})

export const contactPaymentInfoUpdateSchema = contactPaymentInfoSchema

export type ContactPaymentInfoInput = z.infer<typeof contactPaymentInfoSchema>
export type ContactPaymentInfoUpdateInput = z.infer<typeof contactPaymentInfoUpdateSchema>
