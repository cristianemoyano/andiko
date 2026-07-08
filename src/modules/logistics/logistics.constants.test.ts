import { describe, it, expect } from 'vitest'
import {
  SHIPMENT_STATUSES,
  SHIPMENT_TRANSITIONS,
  TERMINAL_SHIPMENT_STATUSES,
  canEditShipment,
  canTransitionShipment,
  assertShipmentTransition,
  resolveInHouseTrackingNumber,
  DELIVERY_RUN_TRANSITIONS,
  TERMINAL_DELIVERY_RUN_STATUSES,
  canTransitionDeliveryRun,
  assertDeliveryRunTransition,
} from './logistics.constants'

describe('shipment status machine', () => {
  it('allows the full courier happy path', () => {
    const path = ['pending', 'ready_to_ship', 'dispatched', 'in_transit', 'out_for_delivery', 'delivered'] as const
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransitionShipment(path[i], path[i + 1])).toBe(true)
    }
  })

  it('allows the in-house short path (pending → dispatched → delivered)', () => {
    expect(canTransitionShipment('pending', 'dispatched')).toBe(true)
    expect(canTransitionShipment('dispatched', 'delivered')).toBe(true)
  })

  it('allows retrying a failed delivery or returning to sender', () => {
    expect(canTransitionShipment('failed', 'out_for_delivery')).toBe(true)
    expect(canTransitionShipment('failed', 'in_transit')).toBe(true)
    expect(canTransitionShipment('failed', 'returned')).toBe(true)
  })

  it('rejects skipping dispatch', () => {
    expect(canTransitionShipment('pending', 'in_transit')).toBe(false)
    expect(canTransitionShipment('pending', 'delivered')).toBe(false)
    expect(canTransitionShipment('ready_to_ship', 'delivered')).toBe(false)
  })

  it('rejects cancelling once in transit', () => {
    expect(canTransitionShipment('in_transit', 'cancelled')).toBe(false)
    expect(canTransitionShipment('out_for_delivery', 'cancelled')).toBe(false)
  })

  it('terminal statuses have no exits', () => {
    for (const status of TERMINAL_SHIPMENT_STATUSES) {
      expect(SHIPMENT_TRANSITIONS[status]).toHaveLength(0)
    }
  })

  it('every transition target is a known status', () => {
    for (const targets of Object.values(SHIPMENT_TRANSITIONS)) {
      for (const target of targets) {
        expect(SHIPMENT_STATUSES).toContain(target)
      }
    }
  })

  it('assertShipmentTransition throws a stable error code', () => {
    expect(() => assertShipmentTransition('delivered', 'pending')).toThrowError('SHIPMENT_INVALID_TRANSITION')
    expect(() => assertShipmentTransition('pending', 'dispatched')).not.toThrow()
  })
})

describe('resolveInHouseTrackingNumber', () => {
  it('defaults to the shipment number', () => {
    expect(resolveInHouseTrackingNumber('ENV-02-0017')).toBe('ENV-02-0017')
    expect(resolveInHouseTrackingNumber('ENV-02-0017', null)).toBe('ENV-02-0017')
    expect(resolveInHouseTrackingNumber('ENV-02-0017', '   ')).toBe('ENV-02-0017')
  })

  it('allows an explicit override', () => {
    expect(resolveInHouseTrackingNumber('ENV-02-0017', 'ETIQUETA-42')).toBe('ETIQUETA-42')
  })
})

describe('canEditShipment', () => {
  it('allows editing non-terminal shipments', () => {
    expect(canEditShipment('pending')).toBe(true)
    expect(canEditShipment('dispatched')).toBe(true)
    expect(canEditShipment('failed')).toBe(true)
    expect(canEditShipment('delivered')).toBe(false)
    expect(canEditShipment('cancelled')).toBe(false)
  })
})

describe('delivery run status machine', () => {
  it('allows the operational happy path', () => {
    const path = ['draft', 'planned', 'dispatched', 'in_progress', 'completed'] as const
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransitionDeliveryRun(path[i], path[i + 1])).toBe(true)
    }
  })

  it('allows cancelling before dispatch only', () => {
    expect(canTransitionDeliveryRun('draft', 'cancelled')).toBe(true)
    expect(canTransitionDeliveryRun('planned', 'cancelled')).toBe(true)
    expect(canTransitionDeliveryRun('dispatched', 'cancelled')).toBe(false)
  })

  it('terminal run statuses have no exits', () => {
    for (const status of TERMINAL_DELIVERY_RUN_STATUSES) {
      expect(DELIVERY_RUN_TRANSITIONS[status]).toHaveLength(0)
    }
  })

  it('assertDeliveryRunTransition throws a stable error code', () => {
    expect(() => assertDeliveryRunTransition('completed', 'planned')).toThrowError('DELIVERY_RUN_INVALID_TRANSITION')
    expect(() => assertDeliveryRunTransition('planned', 'dispatched')).not.toThrow()
  })
})
