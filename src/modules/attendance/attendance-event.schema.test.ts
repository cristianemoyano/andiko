import { describe, it, expect } from 'vitest'
import { attendanceEventSchema, attendanceEventUpdateSchema, dailyTotalsQuerySchema } from './attendance-event.schema'

const baseInput = {
  employee_id: '11111111-1111-4111-8111-111111111111',
  branch_id: '22222222-2222-4222-8222-222222222222',
  event_type: 'clock_in' as const,
}

describe('attendance/attendance-event.schema', () => {
  it('accepts a recent occurred_at', () => {
    const result = attendanceEventSchema.safeParse({ ...baseInput, occurred_at: new Date() })
    expect(result.success).toBe(true)
  })

  it('rejects a future occurred_at', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const result = attendanceEventSchema.safeParse({ ...baseInput, occurred_at: future })
    expect(result.success).toBe(false)
  })

  it('rejects a future occurred_at on update too', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const result = attendanceEventUpdateSchema.safeParse({ occurred_at: future })
    expect(result.success).toBe(false)
  })

  it('dailyTotalsQuerySchema rejects a span wider than 92 days', () => {
    const result = dailyTotalsQuerySchema.safeParse({
      date_from: new Date('2020-01-01'),
      date_to: new Date('2026-01-01'),
    })
    expect(result.success).toBe(false)
  })

  it('dailyTotalsQuerySchema accepts a reasonable span', () => {
    const result = dailyTotalsQuerySchema.safeParse({
      date_from: new Date('2026-01-01'),
      date_to: new Date('2026-01-31'),
    })
    expect(result.success).toBe(true)
  })
})
