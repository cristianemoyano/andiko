import { describe, it, expect } from 'vitest'
import { formatSeatCapacitySummary } from './billing-capacity-summary'

describe('formatSeatCapacitySummary', () => {
  it('shows active users and plan included when within contract', () => {
    expect(formatSeatCapacitySummary({ active: 5, contracted: 3, includedInPlan: 3 }))
      .toBe('5 activos · 3 incluidos en plan')
  })

  it('collapses contract and included when both match and contract is the floor', () => {
    expect(formatSeatCapacitySummary({ active: 2, contracted: 3, includedInPlan: 3 }))
      .toBe('2 activos · mínimo 3 en contrato (incluidos en plan)')
  })

  it('shows both when contract minimum exceeds plan included', () => {
    expect(formatSeatCapacitySummary({ active: 2, contracted: 8, includedInPlan: 3 }))
      .toBe('2 activos · 8 mínimo en contrato · 3 incluidos en plan')
  })
})
