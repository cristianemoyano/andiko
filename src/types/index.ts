export type { UserRole } from './roles'
export type UUID = string

export type IvaRate = '0' | '10.5' | '21' | '27'
export const IVA_RATES: IvaRate[] = ['0', '10.5', '21', '27']

export type PaymentCondition = 'cash' | 'net_30' | 'net_60' | 'net_90'
export const PAYMENT_CONDITIONS: PaymentCondition[] = ['cash', 'net_30', 'net_60', 'net_90']

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
