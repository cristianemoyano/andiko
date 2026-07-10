import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'

export const ATTENDANCE_EVENT_TYPES = ['clock_in', 'clock_out', 'absence'] as const
export const ATTENDANCE_EVENT_SOURCES = ['self_service', 'manual', 'device_import'] as const

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato: HH:mm')

export const attendanceEventSchema = z.object({
  employee_id: z.string().uuid(),
  branch_id:   z.string().uuid(),
  event_type:  z.enum(['clock_in', 'clock_out', 'absence']),
  occurred_at: z.coerce.date(),
  note:        z.string().max(1000).nullable().optional(),
})

export const attendanceEventUpdateSchema = z.object({
  occurred_at: z.coerce.date().optional(),
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

export const dailyTotalsQuerySchema = z.object({
  employee_id: z.string().uuid().optional(),
  branch_id:   z.string().uuid().optional(),
  date_from:   z.coerce.date(),
  date_to:     z.coerce.date(),
})

export type AttendanceEventInput = z.infer<typeof attendanceEventSchema>
export type AttendanceEventUpdateInput = z.infer<typeof attendanceEventUpdateSchema>
export type ManualSessionInput = z.infer<typeof manualSessionSchema>
export type AbsenceInput = z.infer<typeof absenceSchema>
export type AttendanceEventQuery = z.infer<typeof attendanceEventQuerySchema>
export type DailyTotalsQuery = z.infer<typeof dailyTotalsQuerySchema>
