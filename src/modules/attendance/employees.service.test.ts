import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { EmployeeInput } from './employee.schema'
import type { TenantContext } from '@/lib/tenancy'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const transaction = vi.fn(async (fn: (t: unknown) => Promise<unknown>) => fn({}))
vi.mock('@/lib/db', () => ({
  default: { transaction },
}))

const employeeFindOne = vi.fn()
const employeeFindAndCountAll = vi.fn()
const employeeCreate = vi.fn()
vi.mock('./employee.model', () => ({
  default: {
    findOne: employeeFindOne,
    findAndCountAll: employeeFindAndCountAll,
    create: employeeCreate,
  },
}))

const branchFindAll = vi.fn()
vi.mock('@/modules/auth/branch.model', () => ({
  default: { findAll: branchFindAll },
}))

const userFindAll = vi.fn()
vi.mock('@/modules/auth/user.model', () => ({
  default: { findAll: userFindAll },
}))

const ctx: TenantContext = {
  orgId: '4407d9c9-d27e-442f-9906-2c521a61cb5f',
  userId: '834249b2-4168-4879-988c-823881f4f0c3',
  defaultBranchId: '95d2f45f-a3bf-4634-86a6-e7fe88a9a049',
  allowedBranchIds: ['95d2f45f-a3bf-4634-86a6-e7fe88a9a049'],
}

const BRANCH_ID = '95d2f45f-a3bf-4634-86a6-e7fe88a9a049'

const baseInput: EmployeeInput = {
  branch_id: BRANCH_ID,
  user_id: null,
  first_name: 'Ana',
  last_name: 'Gómez',
  cuil: null,
  email: null,
  phone: null,
  position: null,
  employment_type: 'mensualizado',
  standard_weekly_minutes: null,
  hire_date: new Date('2026-01-01'),
  termination_date: null,
  external_employee_code: null,
  is_active: true,
  notes: null,
}

describe('attendance/employees.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createEmployee stamps org_id and actor and returns the created row', async () => {
    employeeFindOne.mockResolvedValue(null)
    employeeCreate.mockResolvedValue({ id: 'emp1' })

    const { createEmployee } = await import('./employees.service')
    const result = await createEmployee(baseInput, ctx, 'actor1')

    expect(employeeCreate).toHaveBeenCalledWith(
      expect.objectContaining({ org_id: ctx.orgId, created_by: 'actor1', updated_by: 'actor1', first_name: 'Ana' }),
    )
    expect(result).toEqual({ id: 'emp1' })
  })

  it('createEmployee rejects a CUIL already used in the same org', async () => {
    employeeFindOne.mockResolvedValueOnce({ id: 'existing' })

    const { createEmployee } = await import('./employees.service')
    await expect(createEmployee({ ...baseInput, cuil: '20-12345678-9' }, ctx, 'actor1'))
      .rejects.toThrow('EMPLOYEE_CUIL_ALREADY_USED')
    expect(employeeCreate).not.toHaveBeenCalled()
  })

  it('createEmployee rejects a user_id already linked to another employee', async () => {
    employeeFindOne.mockResolvedValueOnce({ id: 'existing' })

    const { createEmployee } = await import('./employees.service')
    await expect(createEmployee({ ...baseInput, user_id: 'user2' }, ctx, 'actor1'))
      .rejects.toThrow('EMPLOYEE_USER_ALREADY_LINKED')
    expect(employeeCreate).not.toHaveBeenCalled()
  })

  it('getMyEmployee throws EMPLOYEE_NOT_LINKED when the session user has no employee record', async () => {
    employeeFindOne.mockResolvedValue(null)

    const { getMyEmployee } = await import('./employees.service')
    await expect(getMyEmployee(ctx)).rejects.toThrow('EMPLOYEE_NOT_LINKED')
  })

  it('getMyEmployee resolves the employee linked to the session user', async () => {
    employeeFindOne.mockResolvedValue({ id: 'emp1', user_id: 'user1' })

    const { getMyEmployee } = await import('./employees.service')
    const employee = await getMyEmployee(ctx)
    expect(employee).toEqual({ id: 'emp1', user_id: 'user1' })
  })

  it('importEmployees creates rows resolved by branch_code', async () => {
    branchFindAll.mockResolvedValue([{ id: BRANCH_ID, branch_code: 1 }])
    employeeFindOne.mockResolvedValue(null)
    employeeCreate.mockResolvedValue({ id: 'emp1' })

    const { importEmployees } = await import('./employees.service')
    const result = await importEmployees(
      [{
        first_name: 'Ana',
        last_name: 'Gómez',
        branch_code: '1',
        hire_date: '2026-01-15',
        external_employee_code: '1001',
      }],
      'create',
      ctx,
      'actor1',
    )

    expect(result).toEqual({ created: 1, updated: 0, skipped: 0, errors: [] })
    expect(employeeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: ctx.orgId,
        branch_id: BRANCH_ID,
        first_name: 'Ana',
        external_employee_code: '1001',
        created_by: 'actor1',
      }),
      expect.objectContaining({ transaction: expect.anything() }),
    )
  })

  it('importEmployees rejects unknown branch codes with row errors (all-or-nothing)', async () => {
    branchFindAll.mockResolvedValue([{ id: BRANCH_ID, branch_code: 1 }])

    const { importEmployees } = await import('./employees.service')
    await expect(importEmployees(
      [{
        first_name: 'Ana',
        last_name: 'Gómez',
        branch_code: '99',
        hire_date: '2026-01-15',
      }],
      'create',
      ctx,
      'actor1',
    )).rejects.toMatchObject({
      message: 'IMPORT_VALIDATION_ERRORS',
      importErrors: [expect.objectContaining({ row: 2, message: expect.stringContaining('sucursal') })],
    })
    expect(employeeCreate).not.toHaveBeenCalled()
  })

  it('importEmployees upserts by external_employee_code', async () => {
    branchFindAll.mockResolvedValue([{ id: BRANCH_ID, branch_code: 1 }])
    const existing = { id: 'emp1', update: vi.fn().mockResolvedValue(undefined) }
    employeeFindOne
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    const { importEmployees } = await import('./employees.service')
    const result = await importEmployees(
      [{
        first_name: 'Ana',
        last_name: 'Gómez',
        branch_code: '1',
        hire_date: '2026-01-15',
        external_employee_code: '1001',
        position: 'Supervisora',
      }],
      'upsert',
      ctx,
      'actor1',
    )

    expect(result).toEqual({ created: 0, updated: 1, skipped: 0, errors: [] })
    expect(existing.update).toHaveBeenCalled()
    expect(employeeCreate).not.toHaveBeenCalled()
  })
})
