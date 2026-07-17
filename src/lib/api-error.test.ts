import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))
// The real module pulls in Sequelize models; provide an equivalent class so the
// `instanceof ForbiddenError` check in handleApiError still exercises real behavior.
vi.mock('@/lib/permissions', () => {
  class ForbiddenError extends Error {
    readonly code = 'FORBIDDEN' as const
    constructor(role: string, permission: string) {
      super(`Role '${role}' does not have permission '${permission}'`)
      this.name = 'ForbiddenError'
    }
  }
  return { ForbiddenError }
})

import { z, ZodError } from 'zod'
import { UniqueConstraintError, ForeignKeyConstraintError, ValidationError } from 'sequelize'
import { handleApiError } from './api-error'
import { ForbiddenError } from '@/lib/permissions'
import { TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import logger from '@/lib/logger'

async function jsonOf(response: Response) {
  return { status: response.status, body: await response.json() }
}

describe('handleApiError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps ZodError to 400 VALIDATION_ERROR with details', async () => {
    let zodError: ZodError
    try {
      z.object({ name: z.string() }).parse({})
      throw new Error('unreachable')
    } catch (err) {
      zodError = err as ZodError
    }
    const { status, body } = await jsonOf(handleApiError(zodError))
    expect(status).toBe(400)
    expect(body.code).toBe('VALIDATION_ERROR')
    expect(body.details).toBeDefined()
  })

  it('maps ForbiddenError to 403 FORBIDDEN', async () => {
    const { status, body } = await jsonOf(
      handleApiError(new ForbiddenError('operator', 'sales:read')),
    )
    expect(status).toBe(403)
    expect(body.code).toBe('FORBIDDEN')
  })

  it('maps TenancyError ORG_CONTEXT_REQUIRED to 422', async () => {
    const { status, body } = await jsonOf(
      handleApiError(new TenancyError(TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED)),
    )
    expect(status).toBe(422)
    expect(body.code).toBe('ORG_CONTEXT_REQUIRED')
  })

  it('maps TenancyError BRANCH_NOT_ALLOWED to 403', async () => {
    const { status, body } = await jsonOf(
      handleApiError(new TenancyError(TENANCY_ERROR_CODES.BRANCH_NOT_ALLOWED)),
    )
    expect(status).toBe(403)
    expect(body.code).toBe('BRANCH_NOT_ALLOWED')
  })

  it('maps Sequelize unique/foreign key constraint errors to 409 CONFLICT', async () => {
    const unique = await jsonOf(handleApiError(new UniqueConstraintError({})))
    expect(unique.status).toBe(409)
    expect(unique.body.code).toBe('CONFLICT')

    const fk = await jsonOf(
      handleApiError(new ForeignKeyConstraintError({ message: 'fk violation' })),
    )
    expect(fk.status).toBe(409)
    expect(fk.body.code).toBe('CONFLICT')
  })

  it('maps Sequelize ValidationError to 422 UNPROCESSABLE', async () => {
    const { status, body } = await jsonOf(handleApiError(new ValidationError('invalid', [])))
    expect(status).toBe(422)
    expect(body.code).toBe('UNPROCESSABLE')
  })

  it('maps unknown errors to 500 INTERNAL and logs them without leaking the message', async () => {
    const { status, body } = await jsonOf(handleApiError(new Error('secret internal detail')))
    expect(status).toBe(500)
    expect(body.code).toBe('INTERNAL')
    expect(body.error).not.toContain('secret internal detail')
    expect(logger.error).toHaveBeenCalledOnce()
  })
})
