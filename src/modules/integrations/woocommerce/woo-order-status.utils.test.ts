import { describe, it, expect } from 'vitest'
import {
  isCancelledWooStatus,
  mapWooStatusToErpStatus,
  shouldApplyWooErpStatus,
  wooOrderStatusLabel,
} from './woo-order-status.utils'

describe('mapWooStatusToErpStatus', () => {
  it('maps common Woo statuses to ERP statuses', () => {
    expect(mapWooStatusToErpStatus('pending')).toBe('confirmed')
    expect(mapWooStatusToErpStatus('on-hold')).toBe('confirmed')
    expect(mapWooStatusToErpStatus('processing')).toBe('in_progress')
    expect(mapWooStatusToErpStatus('completed')).toBe('delivered')
    expect(mapWooStatusToErpStatus('cancelled')).toBe('cancelled')
    expect(mapWooStatusToErpStatus('refunded')).toBe('cancelled')
  })
})

describe('shouldApplyWooErpStatus', () => {
  it('advances forward but never downgrades', () => {
    expect(shouldApplyWooErpStatus('confirmed', 'in_progress')).toBe(true)
    expect(shouldApplyWooErpStatus('in_progress', 'delivered')).toBe(true)
    expect(shouldApplyWooErpStatus('delivered', 'in_progress')).toBe(false)
    expect(shouldApplyWooErpStatus('delivered', 'confirmed')).toBe(false)
  })

  it('always allows cancellation from non-terminal states', () => {
    expect(shouldApplyWooErpStatus('in_progress', 'cancelled')).toBe(true)
    expect(shouldApplyWooErpStatus('cancelled', 'confirmed')).toBe(false)
  })

  it('does not change orders already in return states', () => {
    expect(shouldApplyWooErpStatus('partial_returned', 'delivered')).toBe(false)
    expect(shouldApplyWooErpStatus('returned', 'cancelled')).toBe(false)
  })
})

describe('wooOrderStatusLabel', () => {
  it('returns Spanish labels for known statuses', () => {
    expect(wooOrderStatusLabel('processing')).toBe('Procesando')
    expect(wooOrderStatusLabel('completed')).toBe('Completado')
  })

  it('falls back for unknown statuses', () => {
    expect(wooOrderStatusLabel('custom-status')).toBe('custom status')
    expect(wooOrderStatusLabel(null)).toBe('—')
  })
})

describe('isCancelledWooStatus', () => {
  it('detects cancelled-like Woo statuses', () => {
    expect(isCancelledWooStatus('cancelled')).toBe(true)
    expect(isCancelledWooStatus('refunded')).toBe(true)
    expect(isCancelledWooStatus('processing')).toBe(false)
  })
})
