import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { EmployeeInput } from './employee.schema'
import type { TenantContext } from '@/lib/tenancy'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

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

const userFindAll = vi.fn()
vi.mock('@/modules/auth/user.model', () => ({
  default: { findAll: userFindAll },
}))

const ctx: TenantContext = { orgId: 'org1', userId: 'user1', defaultBranchId: 'b1', allowedBranchIds: ['b1'] }

const baseInput: EmployeeInput = {
  branch_id: 'b1',
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
    employeeFindOne.mockResolvedValue(null) // no conflicts
    employeeCreate.mockResolvedValue({ id: 'emp1' })

    const { createEmployee } = await import('./employees.service')
    const result = await createEmployee(baseInput, ctx, 'actor1')

    expect(employeeCreate).toHaveBeenCalledWith(
      expect.objectContaining({ org_id: 'org1', created_by: 'actor1', updated_by: 'actor1', first_name: 'Ana' }),
    )
    expect(result).toEqual({ id: 'emp1' })
  })

  it('createEmployee rejects a CUIL already used in the same org', async () => {
    employeeFindOne.mockResolvedValueOnce({ id: 'existing' }) // cuil conflict check

    const { createEmployee } = await import('./employees.service')
    await expect(createEmployee({ ...baseInput, cuil: '20-12345678-9' }, ctx, 'actor1'))
      .rejects.toThrow('EMPLOYEE_CUIL_ALREADY_USED')
    expect(employeeCreate).not.toHaveBeenCalled()
  })

  it('createEmployee rejects a user_id already linked to another employee', async () => {
    employeeFindOne.mockResolvedValueOnce({ id: 'existing' }) // user_id conflict check

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
})
