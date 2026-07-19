import { z } from 'zod'

export const couponSchema = z.object({
  code:               z.string().min(1).max(40).regex(/^[A-Za-z0-9._-]+$/, 'Código inválido (solo letras, números, . _ -)'),
  max_redemptions:    z.number().int().min(0).nullable().optional(),
  per_customer_limit: z.number().int().min(0).nullable().optional(),
  is_active:          z.boolean().optional().default(true),
})

export const couponUpdateSchema = couponSchema.partial()

export const validateCouponSchema = z.object({
  code: z.string().min(1).max(40),
})

export type CouponInput = z.infer<typeof couponSchema>
export type CouponUpdateInput = z.infer<typeof couponUpdateSchema>
export type ValidateCouponInput = z.infer<typeof validateCouponSchema>
