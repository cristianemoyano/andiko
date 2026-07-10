import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'

export const ATTENDANCE_EVENT_TYPES = ['clock_in', 'clock_out', 'absence'] as const
export const ATTENDANCE_EVENT_SOURCES = ['self_service', 'manual', 'device_import'] as const

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato: HH:mm')

/** Small allowance for client/server clock skew — a genuinely future timestamp would leave
 *  findLastOpenClockIn() permanently "stuck open" until real time catches up to it. */
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000
const notInTheFuture = (value: Date) => value.getTime() <= Date.now() + MAX_CLOCK_SKEW_MS
const NOT_IN_THE_FUTURE_MESSAGE = 'No se pueden cargar fichadas con fecha futura'

export const attendanceEventSchema = z.object({
  employee_id: z.string().uuid(),
  branch_id:   z.string().uuid(),
  event_type:  z.enum(['clock_in', 'clock_out', 'absence']),
  occurred_at: z.coerce.date().refine(notInTheFuture, NOT_IN_THE_FUTURE_MESSAGE),
  note:        z.string().max(1000).nullable().optional(),
})

export const attendanceEventUpdateSchema = z.object({
  occurred_at: z.coerce.date().refine(notInTheFuture, NOT_IN_THE_FUTURE_MESSAGE).optional(),
  branch_id:   z.string().uuid().optional(),
  note:        z.string().max(1000).nullable().optional(),
})

export const manualSessionSchema = z.object({
  employee_id:     z.string().uuid(),
  branch_id:       z.string().uuid(),
  work_date:       z.coerce.date(),
  clock_in_time:   timeOfDay,
  clock_out_time:  timeOfDay,
  note:            z.string().max(1000).nullable().optional(),
}).refine(v => v.clock_out_time > v.clock_in_time, {
  message: 'La salida debe ser posterior a la entrada',
  path: ['clock_out_time'],
})

export const absenceSchema = z.object({
  employee_id: z.string().uuid(),
  branch_id:   z.string().uuid(),
  work_date:   z.coerce.date(),
  note:        z.string().max(1000).nullable().optional(),
})

export const attendanceEventQuerySchema = paginationSchema.extend({
  employee_id: z.string().uuid().optional(),
  branch_id:   z.string().uuid().optional(),
  event_type:  z.enum(ATTENDANCE_EVENT_TYPES).optional(),
  source:      z.enum(ATTENDANCE_EVENT_SOURCES).optional(),
  date_from:   z.coerce.date().optional(),
  date_to:     z.coerce.date().optional(),
})

const MAX_DAILY_TOTALS_SPAN_DAYS = 92

export const dailyTotalsQuerySchema = z.object({
  employee_id: z.string().uuid().optional(),
  branch_id:   z.string().uuid().optional(),
  date_from:   z.coerce.date(),
  date_to:     z.coerce.date(),
}).refine(
  v => (v.date_to.getTime() - v.date_from.getTime()) <= MAX_DAILY_TOTALS_SPAN_DAYS * 24 * 60 * 60 * 1000,
  { message: `El rango no puede superar ${MAX_DAILY_TOTALS_SPAN_DAYS} días`, path: ['date_to'] },
)

export type AttendanceEventInput = z.infer<typeof attendanceEventSchema>
export type AttendanceEventUpdateInput = z.infer<typeof attendanceEventUpdateSchema>
export type ManualSessionInput = z.infer<typeof manualSessionSchema>
export type AbsenceInput = z.infer<typeof absenceSchema>
export type AttendanceEventQuery = z.infer<typeof attendanceEventQuerySchema>
export type DailyTotalsQuery = z.infer<typeof dailyTotalsQuerySchema>
