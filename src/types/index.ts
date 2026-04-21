export type { UserRole } from './roles'
export type UUID = string

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
