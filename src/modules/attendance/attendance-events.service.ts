import 'server-only'
import { Op, type WhereOptions } from 'sequelize'
import AttendanceEvent from './attendance-event.model'
import Employee from './employee.model'
import { getMyEmployee } from './employees.service'
import { assertFullAttendanceAccess } from './attendance-scope'
import { resolveWorkDate, computeDailyTotals } from './attendance.utils'
import { normalizeEventTypeValue, type AttendanceEventTypeAliases } from './attendance-events-csv-adapter'
import type {
  AttendanceEventInput,
  AttendanceEventUpdateInput,
  AttendanceEventQuery,
  ManualSessionInput,
  AbsenceInput,
  DailyTotalsQuery,
} from './attendance-event.schema'
import { paginate, toPaginated, type PaginationQuery } from '@/lib/pagination'
import logger from '@/lib/logger'
import type { TenantContext } from '@/lib/tenancy'
import { whereOrg } from '@/lib/tenancy'
import sequelize from '@/lib/db'

async function assertEmployeeInOrg(employeeId: string, ctx: TenantContext) {
  const employee = await Employee.findOne({ where: whereOrg(ctx, { id: employeeId }) })
  if (!employee) throw new Error('EMPLOYEE_NOT_FOUND')
  return employee
}

/** Argentina has no DST — a fixed UTC-3 offset is always correct. */
function combineDateAndTime(workDate: Date | string, time: string): Date {
  const dateStr = typeof workDate === 'string' ? workDate.slice(0, 10) : workDate.toISOString().slice(0, 10)
  return new Date(`${dateStr}T${time}:00-03:00`)
}

function toWorkDateStr(value: Date | string): string {
  return typeof value === 'string' ? value.slice(0, 10) : resolveWorkDate(value)
}

async function findLastOpenClockIn(employeeId: string, ctx: TenantContext) {
  const last = await AttendanceEvent.findOne({
    where: whereOrg(ctx, { employee_id: employeeId, event_type: { [Op.in]: ['clock_in', 'clock_out'] } }),
    order: [['occurred_at', 'DESC']],
  })
  return last && last.event_type === 'clock_in' ? last : null
}

// --- Self-service (fichaje) ---

export async function clockIn(ctx: TenantContext, actorId: string) {
  const employee = await getMyEmployee(ctx)
  const open = await findLastOpenClockIn(employee.id, ctx)
  if (open) throw new Error('ALREADY_CLOCKED_IN')

  const occurredAt = new Date()
  const event = await AttendanceEvent.create({
    org_id: ctx.orgId,
    branch_id: employee.branch_id,
    employee_id: employee.id,
    event_type: 'clock_in',
    occurred_at: occurredAt,
    work_date: resolveWorkDate(occurredAt),
    source: 'self_service',
    created_by: actorId,
    updated_by: actorId,
  })
  logger.info({ employeeId: employee.id, actorId }, 'employee clocked in')
  return event
}

export async function clockOut(ctx: TenantContext, actorId: string) {
  const employee = await getMyEmployee(ctx)
  const open = await findLastOpenClockIn(employee.id, ctx)
  if (!open) throw new Error('NOT_CLOCKED_IN')

  const occurredAt = new Date()
  const event = await AttendanceEvent.create({
    org_id: ctx.orgId,
    branch_id: employee.branch_id,
    employee_id: employee.id,
    event_type: 'clock_out',
    occurred_at: occurredAt,
    work_date: resolveWorkDate(occurredAt),
    source: 'self_service',
    created_by: actorId,
    updated_by: actorId,
  })
  logger.info({ employeeId: employee.id, actorId }, 'employee clocked out')
  return event
}

export async function getMyStatus(ctx: TenantContext) {
  const employee = await getMyEmployee(ctx)
  const open = await findLastOpenClockIn(employee.id, ctx)
  const todayWorkDate = resolveWorkDate(new Date())
  const todayEvents = await AttendanceEvent.findAll({
    where: whereOrg(ctx, { employee_id: employee.id, work_date: todayWorkDate }),
    order: [['occurred_at', 'ASC']],
  })
  return {
    clockedIn: !!open,
    since: open ? open.occurred_at : null,
    todayEvents,
  }
}

export async function listMyEvents(query: PaginationQuery, ctx: TenantContext) {
  const employee = await getMyEmployee(ctx)
  const { page, limit } = query
  const { offset } = paginate(page, limit)
  const { rows, count } = await AttendanceEvent.findAndCountAll({
    where: whereOrg(ctx, { employee_id: employee.id }),
    order: [['occurred_at', 'DESC']],
    limit,
    offset,
  })
  return toPaginated(rows, count, page, limit)
}

// --- Admin (planilla / correcciones) ---

export async function listAttendanceEvents(query: AttendanceEventQuery, ctx: TenantContext) {
  assertFullAttendanceAccess(ctx)
  const { page, limit, employee_id, branch_id, event_type, source, date_from, date_to } = query
  const { offset } = paginate(page, limit)

  const where: WhereOptions = whereOrg(ctx, {
    ...(employee_id ? { employee_id } : {}),
    ...(branch_id ? { branch_id } : {}),
    ...(event_type ? { event_type } : {}),
    ...(source ? { source } : {}),
    ...(date_from || date_to
      ? {
          occurred_at: {
            ...(date_from ? { [Op.gte]: date_from } : {}),
            ...(date_to ? { [Op.lte]: date_to } : {}),
          },
        }
      : {}),
  })

  const { rows, count } = await AttendanceEvent.findAndCountAll({
    where,
    limit,
    offset,
    order: [['occurred_at', 'DESC']],
  })
  return toPaginated(rows, count, page, limit)
}

export async function getAttendanceEvent(id: string, ctx: TenantContext) {
  assertFullAttendanceAccess(ctx)
  const event = await AttendanceEvent.findOne({ where: whereOrg(ctx, { id }) })
  if (!event) throw new Error('ATTENDANCE_EVENT_NOT_FOUND')
  return event
}

export async function createAttendanceEvent(input: AttendanceEventInput, ctx: TenantContext, actorId: string) {
  assertFullAttendanceAccess(ctx)
  await assertEmployeeInOrg(input.employee_id, ctx)

  const event = await AttendanceEvent.create({
    org_id: ctx.orgId,
    branch_id: input.branch_id,
    employee_id: input.employee_id,
    event_type: input.event_type,
    occurred_at: input.occurred_at,
    work_date: resolveWorkDate(input.occurred_at),
    source: 'manual',
    note: input.note ?? null,
    created_by: actorId,
    updated_by: actorId,
  })
  logger.info({ eventId: event.id, actorId }, 'attendance event created (manual)')
  return event
}

export async function createManualSession(input: ManualSessionInput, ctx: TenantContext, actorId: string) {
  assertFullAttendanceAccess(ctx)
  await assertEmployeeInOrg(input.employee_id, ctx)

  const workDateStr = toWorkDateStr(input.work_date)
  const clockInAt = combineDateAndTime(input.work_date, input.clock_in_time)
  const clockOutAt = combineDateAndTime(input.work_date, input.clock_out_time)
  if (clockOutAt <= clockInAt) throw new Error('INVALID_SESSION_RANGE')

  const result = await sequelize.transaction(async (t) => {
    const clockInEvent = await AttendanceEvent.create({
      org_id: ctx.orgId,
      branch_id: input.branch_id,
      employee_id: input.employee_id,
      event_type: 'clock_in',
      occurred_at: clockInAt,
      work_date: workDateStr,
      source: 'manual',
      note: input.note ?? null,
      created_by: actorId,
      updated_by: actorId,
    }, { transaction: t })

    const clockOutEvent = await AttendanceEvent.create({
      org_id: ctx.orgId,
      branch_id: input.branch_id,
      employee_id: input.employee_id,
      event_type: 'clock_out',
      occurred_at: clockOutAt,
      work_date: workDateStr,
      source: 'manual',
      note: input.note ?? null,
      created_by: actorId,
      updated_by: actorId,
    }, { transaction: t })

    return { clockIn: clockInEvent, clockOut: clockOutEvent }
  })

  logger.info({ employeeId: input.employee_id, actorId }, 'manual attendance session created')
  return result
}

export async function createAbsence(input: AbsenceInput, ctx: TenantContext, actorId: string) {
  assertFullAttendanceAccess(ctx)
  await assertEmployeeInOrg(input.employee_id, ctx)

  const workDateStr = toWorkDateStr(input.work_date)
  const event = await AttendanceEvent.create({
    org_id: ctx.orgId,
    branch_id: input.branch_id,
    employee_id: input.employee_id,
    event_type: 'absence',
    occurred_at: combineDateAndTime(input.work_date, '00:00'),
    work_date: workDateStr,
    source: 'manual',
    note: input.note ?? null,
    created_by: actorId,
    updated_by: actorId,
  })
  logger.info({ employeeId: input.employee_id, actorId }, 'absence recorded')
  return event
}

export async function updateAttendanceEvent(
  id: string,
  input: AttendanceEventUpdateInput,
  ctx: TenantContext,
  actorId: string,
) {
  assertFullAttendanceAccess(ctx)
  const event = await AttendanceEvent.findOne({ where: whereOrg(ctx, { id }) })
  if (!event) throw new Error('ATTENDANCE_EVENT_NOT_FOUND')

  const patch: Record<string, unknown> = { updated_by: actorId }
  if (input.occurred_at) {
    patch.occurred_at = input.occurred_at
    patch.work_date = resolveWorkDate(input.occurred_at)
  }
  if (input.branch_id) patch.branch_id = input.branch_id
  if (input.note !== undefined) patch.note = input.note

  await event.update(patch)
  logger.info({ eventId: id, actorId }, 'attendance event updated')
  return event
}

export async function deleteAttendanceEvent(id: string, ctx: TenantContext, actorId: string) {
  assertFullAttendanceAccess(ctx)
  const event = await AttendanceEvent.findOne({ where: whereOrg(ctx, { id }) })
  if (!event) throw new Error('ATTENDANCE_EVENT_NOT_FOUND')
  await event.update({ deleted_by: actorId })
  await event.destroy()
  logger.info({ eventId: id, actorId }, 'attendance event soft-deleted')
}

export async function getDailyTotals(query: DailyTotalsQuery, ctx: TenantContext) {
  assertFullAttendanceAccess(ctx)
  const { employee_id, branch_id, date_from, date_to } = query

  const events = await AttendanceEvent.findAll({
    where: whereOrg(ctx, {
      ...(employee_id ? { employee_id } : {}),
      ...(branch_id ? { branch_id } : {}),
      work_date: { [Op.gte]: toWorkDateStr(date_from), [Op.lte]: toWorkDateStr(date_to) },
    }),
    order: [['occurred_at', 'ASC']],
  })

  return computeDailyTotals(
    events.map(e => ({
      employee_id: e.employee_id,
      event_type: e.event_type,
      occurred_at: e.occurred_at,
      work_date: e.work_date,
    })),
  )
}

// --- CSV import (relojes físicos) ---

export type AttendanceImportResult = {
  created: number
  skipped: number
  errors: { row: number; message: string }[]
}

export async function importAttendanceEvents(
  rows: Record<string, string>[],
  ctx: TenantContext,
  actorId: string,
  targetBranchId: string,
  eventTypeAliases: AttendanceEventTypeAliases,
): Promise<AttendanceImportResult> {
  assertFullAttendanceAccess(ctx)

  const errors: AttendanceImportResult['errors'] = []
  let created = 0
  let skipped = 0

  const employees = await Employee.findAll({
    where: whereOrg(ctx, { external_employee_code: { [Op.ne]: null } }),
    attributes: ['id', 'external_employee_code'],
  })
  const codeToEmployeeId = new Map(
    employees.map(e => [e.external_employee_code as string, e.id]),
  )

  await sequelize.transaction(async (t) => {
    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2 // 1-based + header row
      const row = rows[i]
      const code = row.employee_code?.trim()
      const employeeId = code ? codeToEmployeeId.get(code) : undefined
      if (!employeeId) {
        errors.push({ row: rowNum, message: `Código de empleado no reconocido: "${code ?? ''}"` })
        continue
      }

      const eventType = normalizeEventTypeValue(row.event_type, eventTypeAliases)
      if (!eventType) {
        errors.push({ row: rowNum, message: `Tipo de evento no reconocido: "${row.event_type ?? ''}"` })
        continue
      }

      const occurredAt = new Date(row.occurred_at)
      if (Number.isNaN(occurredAt.getTime())) {
        errors.push({ row: rowNum, message: `Fecha/hora inválida: "${row.occurred_at ?? ''}"` })
        continue
      }

      const existing = await AttendanceEvent.findOne({
        where: { employee_id: employeeId, event_type: eventType, occurred_at: occurredAt, source: 'device_import' },
        transaction: t,
      })
      if (existing) { skipped++; continue }

      await AttendanceEvent.create({
        org_id: ctx.orgId,
        branch_id: targetBranchId,
        employee_id: employeeId,
        event_type: eventType,
        occurred_at: occurredAt,
        work_date: resolveWorkDate(occurredAt),
        source: 'device_import',
        created_by: actorId,
        updated_by: actorId,
      }, { transaction: t })
      created++
    }

    if (errors.length > 0) {
      throw Object.assign(new Error('ATTENDANCE_IMPORT_ROW_ERRORS'), { importErrors: errors })
    }
  })

  logger.info({ created, skipped, actorId }, 'attendance events imported')
  return { created, skipped, errors: [] }
}
