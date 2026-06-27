import { describe, it, expect, vi } from 'vitest'

vi.mock('./billing-counts.service', () => ({
  countActiveUsers: vi.fn(),
  countActiveBranches: vi.fn(),
}))
vi.mock('./usage.service', () => ({ aggregateUsage: vi.fn() }))
vi.mock('./billing-metric.model', () => ({ default: { findAll: vi.fn() } }))
vi.mock('./billing-plan-metric-allowance.model', () => ({ default: { findAll: vi.fn() } }))
vi.mock('./subscription-metric-allowance.model', () => ({ default: { findAll: vi.fn() } }))
vi.mock('./org-subscription.model', () => ({ default: {} }))
vi.mock('./subscription-addon.model', () => ({ default: {} }))
vi.mock('./subscription-extra.model', () => ({ default: {} }))
vi.mock('./billing-plan.model', () => ({ default: {} }))

import { chargeLinesToPreviewLines } from './billing-charges.service'

describe('chargeLinesToPreviewLines', () => {
  it('includes adjustment capacity lines in preview', () => {
    const lines = [
      {
        kind: 'adjustment' as const,
        description: 'Capacidad — Usuarios: 5 activos · 3 incluidos en plan',
        quantity: '1.0000',
        unit_price: '0.00',
        iva_rate: '21' as const,
        subtotal: '0.00',
        tax_base: '0.00',
        tax_amount: '0.00',
        total: '0.00',
      },
    ]

    const preview = chargeLinesToPreviewLines(lines)

    expect(preview).toHaveLength(1)
    expect(preview[0].isInformational).toBe(true)
  })
})
