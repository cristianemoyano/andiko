import type { CsvHeader } from '@/lib/csv'
import type { AttendanceEventType } from './attendance-event.model'

export const ATTENDANCE_EVENT_CSV_HEADERS: CsvHeader[] = [
  { key: 'employee_code', label: 'Código de empleado' },
  { key: 'occurred_at',   label: 'Fecha y hora' },
  { key: 'event_type',    label: 'Tipo de evento' },
]

export type AttendanceEventTypeAliases = {
  clockIn: string
  clockOut: string
}

/** Maps a raw device CSV event-type value (e.g. "IN"/"OUT", "0"/"1") to our event_type, using admin-provided aliases. */
export function normalizeEventTypeValue(
  raw: string | undefined,
  aliases: AttendanceEventTypeAliases,
): AttendanceEventType | null {
  const value = (raw ?? '').trim().toLowerCase()
  if (!value) return null
  if (value === aliases.clockIn.trim().toLowerCase()) return 'clock_in'
  if (value === aliases.clockOut.trim().toLowerCase()) return 'clock_out'
  return null
}
