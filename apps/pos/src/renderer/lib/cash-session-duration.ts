export const SHIFT_CAUTION_HOURS = 12
export const SHIFT_OVERDUE_HOURS = 24

export type ShiftDurationState = 'normal' | 'caution' | 'overdue'

export function getShiftDurationMs(openedAt: string, nowMs = Date.now()): number {
  const opened = new Date(openedAt).getTime()
  if (Number.isNaN(opened)) return 0
  return Math.max(0, nowMs - opened)
}

export function getShiftDurationState(durationMs: number): ShiftDurationState {
  const hours = durationMs / (1000 * 60 * 60)
  if (hours >= SHIFT_OVERDUE_HOURS) return 'overdue'
  if (hours >= SHIFT_CAUTION_HOURS) return 'caution'
  return 'normal'
}

/** Human-readable elapsed time for an open cash shift. */
export function formatShiftDuration(durationMs: number): string {
  const totalMinutes = Math.floor(durationMs / (1000 * 60))
  if (totalMinutes < 1) return 'Recién abierto'

  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) {
    return hours > 0 ? `${days} d ${hours} h` : `${days} d`
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`
  }
  return `${minutes} min`
}

export function shiftDurationLabel(openedAt: string, nowMs = Date.now()): string {
  return formatShiftDuration(getShiftDurationMs(openedAt, nowMs))
}
