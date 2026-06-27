import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { ORG_MODULE_KEYS } from '@/modules/auth/organization-modules'

const moneyString = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Monto inválido (máx. 2 decimales)')

export const planModuleSchema = z.object({
  module_key:  z.enum(ORG_MODULE_KEYS),
  included:    z.boolean().default(false),
  addon_price: moneyString.default('0.00'),
})

export const billingPlanSchema = z.object({
  code:           z.string().min(1).max(50),
  name:           z.string().min(1).max(255),
  description:    z.string().max(2000).nullable().optional(),
  currency:       z.string().length(3).default('ARS'),
  interval:       z.enum(['monthly', 'annual']).default('monthly'),
  base_price:     moneyString.default('0.00'),
  included_seats: z.coerce.number().int().min(0).default(0),
  per_seat_price: moneyString.default('0.00'),
  is_active:      z.boolean().default(true),
  modules:        z.array(planModuleSchema).default([]),
})

export const billingPlanUpdateSchema = billingPlanSchema.partial()

export const billingPlanQuerySchema = paginationSchema.extend({
  search:    z.string().optional(),
  is_active: z.coerce.boolean().optional(),
})

export type PlanModuleInput = z.infer<typeof planModuleSchema>
export type BillingPlanInput = z.infer<typeof billingPlanSchema>
export type BillingPlanUpdateInput = z.infer<typeof billingPlanUpdateSchema>
export type BillingPlanQuery = z.infer<typeof billingPlanQuerySchema>
