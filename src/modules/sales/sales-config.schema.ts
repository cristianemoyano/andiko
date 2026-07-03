import { z } from 'zod'
import type { PaymentCondition } from '@/types'

/** Preferencia de UX para la acción principal en pedidos. No bloquea otros flujos. */
export const SALES_BILLING_FLOW_PREFERENCES = [
  'flexible',
  'collect_first',
  'invoice_first',
  'on_delivery',
] as const

export type SalesBillingFlowPreference = typeof SALES_BILLING_FLOW_PREFERENCES[number]

export const salesConfigSchema = z.object({
  billing_flow_preference: z.enum(SALES_BILLING_FLOW_PREFERENCES).default('flexible'),
})

export type SalesConfig = z.infer<typeof salesConfigSchema>

export const DEFAULT_SALES_CONFIG: SalesConfig = {
  billing_flow_preference: 'flexible',
}

export function parseSalesConfig(raw: unknown): SalesConfig {
  const parsed = salesConfigSchema.safeParse(raw ?? {})
  return parsed.success ? parsed.data : DEFAULT_SALES_CONFIG
}

/** Sugerencia de modo de facturación según condición de pago (solo UX, no regla de negocio). */
export function suggestedOrderBillMode(paymentCondition: PaymentCondition): 'issue' | 'issue_and_collect' {
  return paymentCondition === 'cash' ? 'issue_and_collect' : 'issue'
}
