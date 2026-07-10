import type { AttendanceEventType } from './attendance-event.model'

export const ATTENDANCE_TIMEZONE = 'America/Argentina/Buenos_Aires'

const workDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: ATTENDANCE_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Calendar day (`yyyy-mm-dd`) an instant falls on, in Argentina local time. */
export function resolveWorkDate(occurredAt: Date): string {
  return workDateFormatter.format(occurredAt)
}

export type AttendanceEventForPairing = {
  employee_id: string
  event_type: AttendanceEventType
  occurred_at: Date | string
  work_date: Date | string
}

export type DailyTotal = {
  employee_id: string
  work_date: string
  worked_minutes: number
  is_open: boolean
  has_absence: boolean
  anomalies: string[]
}

function toWorkDateKey(value: Date | string): string {
  return typeof value === 'string' ? value.slice(0, 10) : resolveWorkDate(value)
}

/**
 * Pairs chronological clock_in/clock_out events per employee/day into worked minutes.
 * Never persisted — computed fresh on every read to avoid storing a lossy hours float.
 */
export function computeDailyTotals(events: AttendanceEventForPairing[]): DailyTotal[] {
  const groups = new Map<string, AttendanceEventForPairing[]>()
  for (const e of events) {
    const key = `${e.employee_id}|${toWorkDateKey(e.work_date)}`
    const bucket = groups.get(key)
    if (bucket) bucket.push(e)
    else groups.set(key, [e])
  }

  const now = Date.now()
  const todayWorkDate = resolveWorkDate(new Date())
  const results: DailyTotal[] = []

  for (const [key, dayEvents] of groups) {
    const [employeeId, workDate] = key.split('|')
    const sorted = [...dayEvents].sort(
      (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
    )

    let workedMinutes = 0
    let openSince: number | null = null
    let hasAbsence = false
    const anomalies: string[] = []

    for (const e of sorted) {
      if (e.event_type === 'absence') {
        hasAbsence = true
        continue
      }
      const t = new Date(e.occurred_at).getTime()
      if (e.event_type === 'clock_in') {
        if (openSince !== null) {
          anomalies.push('DUPLICATE_CLOCK_IN')
          continue
        }
        openSince = t
      } else {
        if (openSince === null) {
          anomalies.push('ORPHAN_CLOCK_OUT')
          continue
        }
        workedMinutes += Math.round((t - openSince) / 60000)
        openSince = null
      }
    }

    let isOpen = false
    if (openSince !== null) {
      isOpen = true
      if (workDate === todayWorkDate) {
        workedMinutes += Math.round((now - openSince) / 60000)
      } else {
        anomalies.push('UNCLOSED_SESSION')
      }
    }

    results.push({
      employee_id: employeeId,
      work_date: workDate,
      worked_minutes: workedMinutes,
      is_open: isOpen,
      has_absence: hasAbsence,
      anomalies,
    })
  }

  return results.sort((a, b) =>
    a.work_date === b.work_date
      ? a.employee_id.localeCompare(b.employee_id)
      : a.work_date.localeCompare(b.work_date),
  )
}
