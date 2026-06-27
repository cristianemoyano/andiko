export type { UserRole } from './roles'
export type UUID = string

export type IvaRate = '0' | '10.5' | '21' | '27'
export const IVA_RATES: IvaRate[] = ['0', '10.5', '21', '27']

export type PaymentCondition = 'cash' | 'net_30' | 'net_60' | 'net_90'
export const PAYMENT_CONDITIONS: PaymentCondition[] = ['cash', 'net_30', 'net_60', 'net_90']

// --- Billing module (platform SaaS subscription billing) ---

export type BillingInterval = 'monthly' | 'annual'
export const BILLING_INTERVALS: BillingInterval[] = ['monthly', 'annual']

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'paused' | 'cancelled'
export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = ['trialing', 'active', 'past_due', 'paused', 'cancelled']

export type BillingInvoiceStatus = 'draft' | 'issued' | 'partially_paid' | 'paid' | 'void'
export const BILLING_INVOICE_STATUSES: BillingInvoiceStatus[] = ['draft', 'issued', 'partially_paid', 'paid', 'void']

export type BillingLineKind = 'base' | 'seat' | 'module_addon' | 'usage' | 'discount' | 'adjustment'
export const BILLING_LINE_KINDS: BillingLineKind[] = ['base', 'seat', 'module_addon', 'usage', 'discount', 'adjustment']

export type BillingPaymentMethod = 'cash' | 'transfer' | 'check' | 'card' | 'other'
export const BILLING_PAYMENT_METHODS: BillingPaymentMethod[] = ['cash', 'transfer', 'check', 'card', 'other']

export type Timestamps = {
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

export type AuditFields = {
  created_by: UUID | null
  updated_by: UUID | null
  deleted_by: UUID | null
  org_id:     UUID | null
}

export type ApiError = {
  error: string
  code: string
  details?: Record<string, unknown>
}
