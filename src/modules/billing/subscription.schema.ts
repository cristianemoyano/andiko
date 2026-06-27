import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { ORG_MODULE_KEYS } from '@/modules/auth/organization-modules'
import { BILLING_EXTRA_KEYS } from '@/modules/billing/billing-extras'
import { TRACKED_METRIC_KEYS } from '@/modules/billing/billing-metrics.catalog'
import { SUBSCRIPTION_STATUSES } from '@/types'

const moneyString = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Monto inválido (máx. 2 decimales)')
const quantityString = z.string().regex(/^\d+(\.\d{1,4})?$/, 'Cantidad inválida (máx. 4 decimales)')

const trackedMetricKeySchema = z.enum(
  TRACKED_METRIC_KEYS as [typeof TRACKED_METRIC_KEYS[number], ...typeof TRACKED_METRIC_KEYS[number][]],
)

export const subscriptionAddonInputSchema = z.object({
  module_key: z.enum(ORG_MODULE_KEYS),
  unit_price: moneyString,
  enabled:    z.boolean().default(true),
})

export const subscriptionExtraInputSchema = z.object({
  extra_key:  z.enum(BILLING_EXTRA_KEYS),
  unit_price: moneyString,
  enabled:    z.boolean().default(true),
})

export const subscriptionMetricAllowanceInputSchema = z.object({
  metric_key:              trackedMetricKeySchema,
  extra_included_quantity: quantityString.default('0.0000'),
})

export const subscriptionCreateSchema = z.object({
  org_id:      z.string().uuid(),
  plan_id:     z.string().uuid(),
  seats:       z.coerce.number().int().min(1).default(1),
  billing_day: z.coerce.number().int().min(1).max(28).default(1),
  status:      z.enum(SUBSCRIPTION_STATUSES).default('trialing'),
  trial_end:   z.coerce.date().nullable().optional(),
  notes:       z.string().max(2000).nullable().optional(),
  addons:             z.array(subscriptionAddonInputSchema).default([]),
  extras:             z.array(subscriptionExtraInputSchema).default([]),
  metric_allowances:  z.array(subscriptionMetricAllowanceInputSchema).default([]),
})

export const subscriptionUpdateSchema = z.object({
  plan_id:     z.string().uuid().optional(),
  seats:       z.coerce.number().int().min(1).optional(),
  billing_day: z.coerce.number().int().min(1).max(28).optional(),
  status:      z.enum(SUBSCRIPTION_STATUSES).optional(),
  trial_end:   z.coerce.date().nullable().optional(),
  notes:       z.string().max(2000).nullable().optional(),
  addons:             z.array(subscriptionAddonInputSchema).optional(),
  extras:             z.array(subscriptionExtraInputSchema).optional(),
  metric_allowances:  z.array(subscriptionMetricAllowanceInputSchema).optional(),
})

export const subscriptionQuerySchema = paginationSchema.extend({
  org_id: z.string().uuid().optional(),
  status: z.enum(SUBSCRIPTION_STATUSES).optional(),
})

export type SubscriptionAddonInput = z.infer<typeof subscriptionAddonInputSchema>
export type SubscriptionExtraInput = z.infer<typeof subscriptionExtraInputSchema>
export type SubscriptionMetricAllowanceInput = z.infer<typeof subscriptionMetricAllowanceInputSchema>
export type SubscriptionCreateInput = z.infer<typeof subscriptionCreateSchema>
export type SubscriptionUpdateInput = z.infer<typeof subscriptionUpdateSchema>
export type SubscriptionQuery = z.infer<typeof subscriptionQuerySchema>
