import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { ORG_MODULE_KEYS } from '@/modules/auth/organization-modules'
import { BILLING_EXTRA_KEYS } from '@/modules/billing/billing-extras'
import { TRACKED_METRIC_KEYS } from '@/modules/billing/billing-metrics.catalog'

const moneyString = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Monto inválido (máx. 2 decimales)')
const quantityString = z.string().regex(/^\d+(\.\d{1,4})?$/, 'Cantidad inválida (máx. 4 decimales)')

const trackedMetricKeySchema = z.enum(
  TRACKED_METRIC_KEYS as [typeof TRACKED_METRIC_KEYS[number], ...typeof TRACKED_METRIC_KEYS[number][]],
)

export const planModuleSchema = z.object({
  module_key:  z.enum(ORG_MODULE_KEYS),
  included:    z.boolean().default(false),
  addon_price: moneyString.default('0.00'),
})

export const planExtraSchema = z.object({
  extra_key:   z.enum(BILLING_EXTRA_KEYS),
  included:    z.boolean().default(false),
  addon_price: moneyString.default('0.00'),
})

export const planMetricAllowanceSchema = z.object({
  metric_key:         trackedMetricKeySchema,
  included_quantity:  quantityString.default('0.0000'),
  unit_price:         moneyString.default('0.00'),
})

export const billingPlanSchema = z.object({
  code:           z.string().min(1).max(50),
  name:           z.string().min(1).max(255),
  description:    z.string().max(2000).nullable().optional(),
  currency:       z.string().length(3).default('ARS'),
  interval:       z.enum(['monthly', 'annual']).default('monthly'),
  base_price:     moneyString.default('0.00'),
  included_seats:    z.coerce.number().int().min(0).default(0),
  per_seat_price:    moneyString.default('0.00'),
  included_branches: z.coerce.number().int().min(0).default(1),
  per_branch_price:  moneyString.default('0.00'),
  included_sites:    z.coerce.number().int().min(0).default(0),
  per_site_price:    moneyString.default('0.00'),
  is_active:         z.boolean().default(true),
  modules:            z.array(planModuleSchema).default([]),
  extras:             z.array(planExtraSchema).default([]),
  metric_allowances:  z.array(planMetricAllowanceSchema).default([]),
})

export const billingPlanUpdateSchema = billingPlanSchema.partial()

export const billingPlanQuerySchema = paginationSchema.extend({
  search:    z.string().optional(),
  is_active: z.coerce.boolean().optional(),
})

export type PlanModuleInput = z.infer<typeof planModuleSchema>
export type PlanExtraInput = z.infer<typeof planExtraSchema>
export type PlanMetricAllowanceInput = z.infer<typeof planMetricAllowanceSchema>
export type BillingPlanInput = z.infer<typeof billingPlanSchema>
export type BillingPlanUpdateInput = z.infer<typeof billingPlanUpdateSchema>
export type BillingPlanQuery = z.infer<typeof billingPlanQuerySchema>
