import { describe, it, expect } from 'vitest'
import { computeDailyTotals, resolveWorkDate } from './attendance.utils'

describe('attendance/attendance.utils', () => {
  it('resolveWorkDate returns the Argentina calendar day (yyyy-mm-dd)', () => {
    // 2026-01-01 02:30 UTC = 2025-12-31 23:30 in Argentina (UTC-3)
    expect(resolveWorkDate(new Date('2026-01-01T02:30:00Z'))).toBe('2025-12-31')
    expect(resolveWorkDate(new Date('2026-01-01T05:00:00Z'))).toBe('2026-01-01')
  })

  it('pairs a single clock_in/clock_out session into worked minutes', () => {
    const [daily] = computeDailyTotals([
      { employee_id: 'e1', event_type: 'clock_in', occurred_at: '2026-01-05T09:00:00-03:00', work_date: '2026-01-05' },
      { employee_id: 'e1', event_type: 'clock_out', occurred_at: '2026-01-05T18:00:00-03:00', work_date: '2026-01-05' },
    ])
    expect(daily.worked_minutes).toBe(9 * 60)
    expect(daily.is_open).toBe(false)
    expect(daily.has_absence).toBe(false)
    expect(daily.anomalies).toEqual([])
  })

  it('flags a duplicate clock_in without a matching clock_out first, without double counting', () => {
    const [daily] = computeDailyTotals([
      { employee_id: 'e1', event_type: 'clock_in', occurred_at: '2026-01-05T09:00:00-03:00', work_date: '2026-01-05' },
      { employee_id: 'e1', event_type: 'clock_in', occurred_at: '2026-01-05T09:30:00-03:00', work_date: '2026-01-05' },
      { employee_id: 'e1', event_type: 'clock_out', occurred_at: '2026-01-05T18:00:00-03:00', work_date: '2026-01-05' },
    ])
    expect(daily.anomalies).toContain('DUPLICATE_CLOCK_IN')
    expect(daily.worked_minutes).toBe(9 * 60) // paired against the first (09:00) clock_in, not the second
  })

  it('flags an orphan clock_out with no prior open clock_in', () => {
    const [daily] = computeDailyTotals([
      { employee_id: 'e1', event_type: 'clock_out', occurred_at: '2026-01-05T18:00:00-03:00', work_date: '2026-01-05' },
    ])
    expect(daily.anomalies).toContain('ORPHAN_CLOCK_OUT')
    expect(daily.worked_minutes).toBe(0)
  })

  it('marks has_absence for an absence event, independent of clock events', () => {
    const [daily] = computeDailyTotals([
      { employee_id: 'e1', event_type: 'absence', occurred_at: '2026-01-05T00:00:00-03:00', work_date: '2026-01-05' },
    ])
    expect(daily.has_absence).toBe(true)
    expect(daily.worked_minutes).toBe(0)
  })

  it('flags an unclosed session from a past day as an anomaly instead of counting it up to now', () => {
    const [daily] = computeDailyTotals([
      { employee_id: 'e1', event_type: 'clock_in', occurred_at: '2020-01-05T09:00:00-03:00', work_date: '2020-01-05' },
    ])
    expect(daily.is_open).toBe(true)
    expect(daily.anomalies).toContain('UNCLOSED_SESSION')
    expect(daily.worked_minutes).toBe(0)
  })

  it('groups totals independently per employee and per day', () => {
    const results = computeDailyTotals([
      { employee_id: 'e1', event_type: 'clock_in', occurred_at: '2026-01-05T09:00:00-03:00', work_date: '2026-01-05' },
      { employee_id: 'e1', event_type: 'clock_out', occurred_at: '2026-01-05T13:00:00-03:00', work_date: '2026-01-05' },
      { employee_id: 'e2', event_type: 'clock_in', occurred_at: '2026-01-05T09:00:00-03:00', work_date: '2026-01-05' },
      { employee_id: 'e2', event_type: 'clock_out', occurred_at: '2026-01-05T17:00:00-03:00', work_date: '2026-01-05' },
    ])
    expect(results).toHaveLength(2)
    const e1 = results.find(r => r.employee_id === 'e1')!
    const e2 = results.find(r => r.employee_id === 'e2')!
    expect(e1.worked_minutes).toBe(4 * 60)
    expect(e2.worked_minutes).toBe(8 * 60)
  })
})
