import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'

export const EMPLOYMENT_TYPES = ['mensualizado', 'jornalizado', 'por_hora'] as const

export const employeeSchema = z.object({
  branch_id:               z.string().uuid(),
  user_id:                 z.string().uuid().nullable().optional(),
  first_name:              z.string().min(1).max(100),
  last_name:               z.string().min(1).max(100),
  cuil:                    z.string().max(13).nullable().optional(),
  email:                   z.string().email().max(255).nullable().optional(),
  phone:                   z.string().max(50).nullable().optional(),
  position:                z.string().max(120).nullable().optional(),
  employment_type:         z.enum(EMPLOYMENT_TYPES).default('mensualizado'),
  standard_weekly_minutes: z.coerce.number().int().positive().nullable().optional(),
  hire_date:                z.coerce.date(),
  termination_date:        z.coerce.date().nullable().optional(),
  external_employee_code:  z.string().max(32).nullable().optional(),
  is_active:               z.boolean().default(true),
  notes:                   z.string().max(2000).nullable().optional(),
})

export const employeeUpdateSchema = employeeSchema.partial()

export const employeeQuerySchema = paginationSchema.extend({
  search:    z.string().optional(),
  branch_id: z.string().uuid().optional(),
  is_active: z.coerce.boolean().optional(),
})

export type EmployeeInput = z.infer<typeof employeeSchema>
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>
export type EmployeeQuery = z.infer<typeof employeeQuerySchema>
