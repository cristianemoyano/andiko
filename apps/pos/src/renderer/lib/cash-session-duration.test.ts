import { describe, expect, it } from 'vitest'
import {
  formatShiftDuration,
  getShiftDurationState,
  shiftDurationLabel,
} from './cash-session-duration'

describe('cash-session-duration', () => {
  it('formats minutes and hours', () => {
    expect(formatShiftDuration(45 * 60_000)).toBe('45 min')
    expect(formatShiftDuration(2 * 60 * 60_000 + 15 * 60_000)).toBe('2 h 15 min')
  })

  it('classifies shift duration states', () => {
    expect(getShiftDurationState(6 * 60 * 60_000)).toBe('normal')
    expect(getShiftDurationState(13 * 60 * 60_000)).toBe('caution')
    expect(getShiftDurationState(25 * 60 * 60_000)).toBe('overdue')
  })

  it('builds label from opened_at', () => {
    const opened = new Date('2026-06-21T10:00:00').toISOString()
    const now = new Date('2026-06-21T14:30:00').getTime()
    expect(shiftDurationLabel(opened, now)).toBe('4 h 30 min')
  })
})
