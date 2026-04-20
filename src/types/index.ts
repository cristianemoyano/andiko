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
}

export type ApiResponse<T> = {
  data: T
  meta?: {
    total?: number
    page?: number
    limit?: number
  }
}

export type ApiError = {
  error: string
  code: string
  details?: Record<string, unknown>
}

export type PaginationParams = {
  page?: number
  limit?: number
}
