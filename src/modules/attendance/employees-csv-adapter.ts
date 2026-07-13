import type { CsvHeader } from '@/lib/csv'
import { EMPLOYMENT_TYPES, type EmployeeInput, type EmployeeUpdateInput } from './employee.schema'

export const EMPLOYEE_CSV_HEADERS: CsvHeader[] = [
  { key: 'external_employee_code', label: 'Código de legajo' },
  { key: 'first_name',             label: 'Nombre' },
  { key: 'last_name',              label: 'Apellido' },
  { key: 'branch_code',            label: 'Código sucursal' },
  { key: 'hire_date',              label: 'Fecha de ingreso' },
  { key: 'cuil',                   label: 'CUIL' },
  { key: 'email',                  label: 'Email' },
  { key: 'phone',                  label: 'Teléfono' },
  { key: 'position',               label: 'Puesto' },
  { key: 'employment_type',        label: 'Tipo de jornada' },
  { key: 'weekly_hours',           label: 'Horas semanales' },
  { key: 'termination_date',       label: 'Fecha de egreso' },
  { key: 'is_active',              label: 'Activo' },
  { key: 'notes',                  label: 'Notas' },
]

export const EMPLOYEE_CSV_REQUIRED_FIELDS = [
  'first_name',
  'last_name',
  'branch_code',
  'hire_date',
] as const

/** Preferido para upsert / matching con el CSV del reloj. */
export const EMPLOYEE_CSV_MATCH_KEY = 'external_employee_code'

function emptyToNull(value: string | undefined): string | null {
  const v = value?.trim()
  return v ? v : null
}

function parseOptionalDate(value: string | undefined): Date | null | undefined {
  const v = value?.trim()
  if (!v) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return undefined
  return d
}

function parseWeeklyMinutes(value: string | undefined): number | null | undefined {
  const v = value?.trim()
  if (!v) return null
  const hours = Number(v.replace(',', '.'))
  if (!Number.isFinite(hours) || hours <= 0) return undefined
  return Math.round(hours * 60)
}

function parseIsActive(value: string | undefined): boolean | undefined {
  const v = value?.trim().toLowerCase()
  if (!v) return undefined
  if (['true', '1', 'si', 'sí', 'yes', 'activo'].includes(v)) return true
  if (['false', '0', 'no', 'inactivo'].includes(v)) return false
  return undefined
}

function parseEmploymentType(value: string | undefined): EmployeeInput['employment_type'] | undefined {
  const v = value?.trim().toLowerCase()
  if (!v) return undefined
  return (EMPLOYMENT_TYPES as readonly string[]).includes(v)
    ? (v as EmployeeInput['employment_type'])
    : undefined
}

export type EmployeeCsvMappedRow = {
  first_name: string
  last_name: string
  branch_code: string
  hire_date: string
  external_employee_code: string | null
  cuil: string | null
  email: string | null
  phone: string | null
  position: string | null
  employment_type?: EmployeeInput['employment_type']
  standard_weekly_minutes: number | null | undefined
  termination_date: Date | null | undefined
  is_active?: boolean
  notes: string | null
}

/** Normaliza una fila CSV (ya mapeada a claves internas) antes de validar con Zod. */
export function normalizeEmployeeImportRow(row: Record<string, string>): EmployeeCsvMappedRow {
  return {
    first_name: (row.first_name ?? '').trim(),
    last_name: (row.last_name ?? '').trim(),
    branch_code: (row.branch_code ?? '').trim(),
    hire_date: (row.hire_date ?? '').trim(),
    external_employee_code: emptyToNull(row.external_employee_code),
    cuil: emptyToNull(row.cuil),
    email: emptyToNull(row.email),
    phone: emptyToNull(row.phone),
    position: emptyToNull(row.position),
    employment_type: parseEmploymentType(row.employment_type),
    standard_weekly_minutes: parseWeeklyMinutes(row.weekly_hours),
    termination_date: parseOptionalDate(row.termination_date),
    is_active: parseIsActive(row.is_active),
    notes: emptyToNull(row.notes),
  }
}

export function rowToEmployeeInput(
  row: EmployeeCsvMappedRow,
  branchId: string,
): Omit<EmployeeInput, 'user_id'> & { user_id?: null } {
  return {
    branch_id: branchId,
    user_id: null,
    first_name: row.first_name,
    last_name: row.last_name,
    hire_date: new Date(row.hire_date),
    external_employee_code: row.external_employee_code,
    cuil: row.cuil,
    email: row.email,
    phone: row.phone,
    position: row.position,
    employment_type: row.employment_type ?? 'mensualizado',
    standard_weekly_minutes: row.standard_weekly_minutes ?? null,
    termination_date: row.termination_date ?? null,
    is_active: row.is_active ?? true,
    notes: row.notes,
  }
}

export function rowToEmployeeUpdateInput(
  row: EmployeeCsvMappedRow,
  branchId: string | undefined,
): EmployeeUpdateInput {
  return {
    ...(branchId ? { branch_id: branchId } : {}),
    first_name: row.first_name || undefined,
    last_name: row.last_name || undefined,
    ...(row.hire_date ? { hire_date: new Date(row.hire_date) } : {}),
    external_employee_code: row.external_employee_code,
    cuil: row.cuil,
    email: row.email,
    phone: row.phone,
    position: row.position,
    ...(row.employment_type ? { employment_type: row.employment_type } : {}),
    ...(row.standard_weekly_minutes !== undefined
      ? { standard_weekly_minutes: row.standard_weekly_minutes }
      : {}),
    ...(row.termination_date !== undefined ? { termination_date: row.termination_date } : {}),
    ...(row.is_active !== undefined ? { is_active: row.is_active } : {}),
    notes: row.notes,
  }
}
