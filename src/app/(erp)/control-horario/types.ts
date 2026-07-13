export type EmploymentType = 'mensualizado' | 'jornalizado' | 'por_hora'

export type EmployeeRow = {
  id: string
  branch_id: string
  user_id: string | null
  first_name: string
  last_name: string
  cuil: string | null
  email: string | null
  phone: string | null
  position: string | null
  employment_type: EmploymentType
  standard_weekly_minutes: number | null
  hire_date: string
  termination_date: string | null
  external_employee_code: string | null
  is_active: boolean
  notes: string | null
}

export type AttendanceEventType = 'clock_in' | 'clock_out' | 'absence'
export type AttendanceEventSource = 'self_service' | 'manual' | 'device_import'

export type AttendanceEventRow = {
  id: string
  branch_id: string
  employee_id: string
  event_type: AttendanceEventType
  occurred_at: string
  work_date: string
  source: AttendanceEventSource
  note: string | null
}

export type DailyTotal = {
  employee_id: string
  work_date: string
  worked_minutes: number
  is_open: boolean
  has_absence: boolean
  anomalies: string[]
}

export type MyStatus = {
  clockedIn: boolean
  since: string | null
  todayEvents: AttendanceEventRow[]
}
