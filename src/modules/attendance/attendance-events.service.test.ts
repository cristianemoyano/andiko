import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Op } from 'sequelize'
import type { TenantContext } from '@/lib/tenancy'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const transactionMock = vi.fn(async (fn: (t: unknown) => unknown) => fn({}))
vi.mock('@/lib/db', () => ({
  default: { transaction: transactionMock },
}))

const eventFindOne = vi.fn()
const eventFindAll = vi.fn()
const eventFindAndCountAll = vi.fn()
const eventCreate = vi.fn()
vi.mock('./attendance-event.model', () => ({
  default: {
    findOne: eventFindOne,
    findAll: eventFindAll,
    findAndCountAll: eventFindAndCountAll,
    create: eventCreate,
  },
}))

const employeeFindOne = vi.fn()
const employeeFindAll = vi.fn()
vi.mock('./employee.model', () => ({
  default: {
    findOne: employeeFindOne,
    findAll: employeeFindAll,
  },
}))

const getMyEmployeeMock = vi.fn()
vi.mock('./employees.service', () => ({
  getMyEmployee: getMyEmployeeMock,
}))

const ctx: TenantContext = { orgId: 'org1', userId: 'user1', defaultBranchId: 'b1', allowedBranchIds: ['b1'] }

describe('attendance/attendance-events.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clockIn creates a self-service clock_in event stamped with the employee home branch', async () => {
    getMyEmployeeMock.mockResolvedValue({ id: 'emp1', branch_id: 'b1' })
    eventFindOne.mockResolvedValue(null) // no open clock_in
    eventCreate.mockResolvedValue({ id: 'ev1', event_type: 'clock_in' })

    const { clockIn } = await import('./attendance-events.service')
    await clockIn(ctx, 'actor1')

    expect(eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org1',
        branch_id: 'b1',
        employee_id: 'emp1',
        event_type: 'clock_in',
        source: 'self_service',
      }),
    )
  })

  it('clockIn rejects a second entrada without a prior salida', async () => {
    getMyEmployeeMock.mockResolvedValue({ id: 'emp1', branch_id: 'b1' })
    eventFindOne.mockResolvedValue({ event_type: 'clock_in' }) // already open

    const { clockIn } = await import('./attendance-events.service')
    await expect(clockIn(ctx, 'actor1')).rejects.toThrow('ALREADY_CLOCKED_IN')
    expect(eventCreate).not.toHaveBeenCalled()
  })

  it('clockOut rejects when there is no open entrada', async () => {
    getMyEmployeeMock.mockResolvedValue({ id: 'emp1', branch_id: 'b1' })
    eventFindOne.mockResolvedValue(null)

    const { clockOut } = await import('./attendance-events.service')
    await expect(clockOut(ctx, 'actor1')).rejects.toThrow('NOT_CLOCKED_IN')
    expect(eventCreate).not.toHaveBeenCalled()
  })

  it('importAttendanceEvents creates a row for a device punch not seen before', async () => {
    employeeFindAll.mockResolvedValue([{ id: 'emp1', external_employee_code: '123' }])
    eventFindOne.mockResolvedValue(null) // not a duplicate yet
    eventCreate.mockResolvedValue({ id: 'ev1' })

    const { importAttendanceEvents } = await import('./attendance-events.service')
    const result = await importAttendanceEvents(
      [{ employee_code: '123', occurred_at: '2026-01-05T09:00:00-03:00', event_type: 'IN' }],
      ctx,
      'actor1',
      'b1',
      { clockIn: 'IN', clockOut: 'OUT' },
    )

    expect(result).toEqual({ created: 1, skipped: 0, errors: [] })
    expect(eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'device_import', employee_id: 'emp1', event_type: 'clock_in', branch_id: 'b1' }),
      expect.anything(),
    )
  })

  it('importAttendanceEvents skips a punch already imported (idempotent re-import)', async () => {
    employeeFindAll.mockResolvedValue([{ id: 'emp1', external_employee_code: '123' }])
    eventFindOne.mockResolvedValue({ id: 'already-there' }) // dedup index hit

    const { importAttendanceEvents } = await import('./attendance-events.service')
    const result = await importAttendanceEvents(
      [{ employee_code: '123', occurred_at: '2026-01-05T09:00:00-03:00', event_type: 'IN' }],
      ctx,
      'actor1',
      'b1',
      { clockIn: 'IN', clockOut: 'OUT' },
    )

    expect(result).toEqual({ created: 0, skipped: 1, errors: [] })
    expect(eventCreate).not.toHaveBeenCalled()
  })

  it('importAttendanceEvents reports an unrecognized device employee code as a row error', async () => {
    employeeFindAll.mockResolvedValue([]) // no employees have this code

    const { importAttendanceEvents } = await import('./attendance-events.service')
    await expect(importAttendanceEvents(
      [{ employee_code: '999', occurred_at: '2026-01-05T09:00:00-03:00', event_type: 'IN' }],
      ctx,
      'actor1',
      'b1',
      { clockIn: 'IN', clockOut: 'OUT' },
    )).rejects.toThrow('ATTENDANCE_IMPORT_ROW_ERRORS')
    expect(eventCreate).not.toHaveBeenCalled()
  })

  it('importAttendanceEvents rejects a target branch outside the caller\'s allowed branches', async () => {
    const { importAttendanceEvents } = await import('./attendance-events.service')
    await expect(importAttendanceEvents(
      [{ employee_code: '123', occurred_at: '2026-01-05T09:00:00-03:00', event_type: 'IN' }],
      ctx, // allowedBranchIds: ['b1']
      'actor1',
      'other-branch',
      { clockIn: 'IN', clockOut: 'OUT' },
    )).rejects.toThrow('BRANCH_NOT_ALLOWED')
  })

  it('listAttendanceEvents scopes the query to the caller\'s allowed branches', async () => {
    eventFindAndCountAll.mockResolvedValue({ rows: [], count: 0 })

    const { listAttendanceEvents } = await import('./attendance-events.service')
    await listAttendanceEvents({ page: 1, limit: 20 }, ctx) // allowedBranchIds: ['b1']

    const arg = eventFindAndCountAll.mock.calls[0]![0]
    expect(arg.where).toMatchObject({ org_id: 'org1', branch_id: { [Op.in]: ['b1'] } })
  })

  it('listAttendanceEvents forces employee_id to the caller\'s own employee for scope_own users, ignoring the query filter', async () => {
    eventFindAndCountAll.mockResolvedValue({ rows: [], count: 0 })
    getMyEmployeeMock.mockResolvedValue({ id: 'emp-own' })
    const scopedCtx: TenantContext = { ...ctx, attendanceScopeOwn: true }

    const { listAttendanceEvents } = await import('./attendance-events.service')
    await listAttendanceEvents({ page: 1, limit: 20, employee_id: 'someone-else' }, scopedCtx)

    const arg = eventFindAndCountAll.mock.calls[0]![0]
    expect(arg.where.employee_id).toBe('emp-own')
  })

  it('listAttendanceEvents filters by work_date (not occurred_at) so "today" is not excluded by a UTC/ART mismatch', async () => {
    eventFindAndCountAll.mockResolvedValue({ rows: [], count: 0 })

    const { listAttendanceEvents } = await import('./attendance-events.service')
    // A DatePicker-style UTC-midnight Date for "today" in Argentina — this is the exact input
    // that used to make listAttendanceEvents's old occurred_at-based filter exclude everything.
    const utcMidnight = new Date('2026-07-10T00:00:00.000Z')
    await listAttendanceEvents({ page: 1, limit: 20, date_from: utcMidnight, date_to: utcMidnight }, ctx)

    const arg = eventFindAndCountAll.mock.calls[0]![0]
    expect(arg.where.occurred_at).toBeUndefined()
    expect(arg.where.work_date).toEqual({ [Op.gte]: '2026-07-09', [Op.lte]: '2026-07-09' })
  })

  it('getAttendanceEvent returns not-found for a record outside the caller\'s allowed branches', async () => {
    eventFindOne.mockResolvedValue(null) // whereAllowedBranches excludes it at the query level

    const { getAttendanceEvent } = await import('./attendance-events.service')
    await expect(getAttendanceEvent('ev1', ctx)).rejects.toThrow('ATTENDANCE_EVENT_NOT_FOUND')
    const arg = eventFindOne.mock.calls[0]![0]
    expect(arg.where).toMatchObject({ branch_id: { [Op.in]: ['b1'] } })
  })
})
