import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import Decimal from 'decimal.js'

vi.mock('@/lib/db', () => ({
  default: { transaction: vi.fn((cb: (t: object) => Promise<unknown>) => cb({})) },
}))

vi.mock('@/lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('./production-order.model', () => ({
  default: { findOne: vi.fn(), findAndCountAll: vi.fn(), create: vi.fn() },
}))

vi.mock('./production-order-line.model', () => ({
  default: { findAll: vi.fn(), create: vi.fn(), destroy: vi.fn() },
}))

vi.mock('./bom.model', () => ({
  default: { findOne: vi.fn() },
}))

vi.mock('./bom-item.model', () => ({ default: {} }))

vi.mock('@/modules/catalog/product-variant.model', () => ({
  default: { update: vi.fn() },
}))

vi.mock('@/modules/catalog/product.model', () => ({ default: {} }))
vi.mock('@/modules/inventory/warehouse.model', () => ({ default: {} }))

vi.mock('./production-associations', () => ({
  ensureProductionAssociations: vi.fn(),
}))

vi.mock('./production.utils', () => ({
  nextProductionOrderNumber: vi.fn().mockResolvedValue('OP-01-0001'),
  computeBomRollupCost: vi.fn().mockReturnValue(new Decimal('12.50')),
}))

vi.mock('./boms.service', () => ({
  getActiveBomForVariant: vi.fn(),
}))

vi.mock('@/modules/inventory/stock-movements.service', () => ({
  applyMovement: vi.fn(),
}))

vi.mock('@/modules/inventory/stock-movement.model', () => ({
  default: { findAll: vi.fn() },
}))

vi.mock('@/modules/auth/branch.model', () => ({ default: {} }))

import ProductionOrder from './production-order.model'
import ProductionOrderLine from './production-order-line.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import {
  releaseProductionOrder,
  completeProductionOrder,
  cancelProductionOrder,
} from './production-orders.service'
import { applyMovement } from '@/modules/inventory/stock-movements.service'
import StockMovement from '@/modules/inventory/stock-movement.model'

const T = {} as never

function mockOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    org_id: 'org-1',
    order_number: 'OP-01-0001',
    branch_id: 'branch-1',
    warehouse_id: 'wh-1',
    bom_id: 'bom-1',
    variant_id: 'var-finished',
    status: 'draft',
    planned_quantity: '10.0000',
    produced_quantity: '0.0000',
    update: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('releaseProductionOrder', () => {
  it('consumes each line via applyMovement (out) and marks the order released', async () => {
    const order = mockOrder({ status: 'draft' })
    ;(ProductionOrder.findOne as Mock)
      .mockResolvedValueOnce(order) // lock inside transaction
      .mockResolvedValueOnce({ ...order, status: 'released' }) // post-commit getProductionOrder

    const line1 = { component_variant_id: 'comp-1', planned_quantity: '4.0000', update: vi.fn().mockResolvedValue(undefined) }
    const line2 = { component_variant_id: 'comp-2', planned_quantity: '2.0000', update: vi.fn().mockResolvedValue(undefined) }
    ;(ProductionOrderLine.findAll as Mock).mockResolvedValue([line1, line2])

    await releaseProductionOrder('order-1', 'org-1', 'actor-1')

    expect(applyMovement).toHaveBeenCalledTimes(2)
    expect(applyMovement).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        variantId: 'comp-1',
        warehouseId: 'wh-1',
        movementType: 'out',
        referenceType: 'production_order',
        referenceId: 'order-1',
        quantityDelta: expect.any(Decimal),
      }),
      T,
    )
    expect((applyMovement as Mock).mock.calls[0][0].quantityDelta.toString()).toBe('-4')
    expect(line1.update).toHaveBeenCalledWith({ consumed_quantity: '4.0000' }, { transaction: T })
    expect(order.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'released' }),
      { transaction: T },
    )
  })

  it('throws PRODUCTION_ORDER_INVALID_STATUS when the order is not draft', async () => {
    ;(ProductionOrder.findOne as Mock).mockResolvedValueOnce(mockOrder({ status: 'released' }))
    await expect(releaseProductionOrder('order-1', 'org-1', 'actor-1')).rejects.toThrow('PRODUCTION_ORDER_INVALID_STATUS')
    expect(applyMovement).not.toHaveBeenCalled()
  })

  it('throws PRODUCTION_ORDER_NO_WAREHOUSE when the order has no warehouse assigned', async () => {
    ;(ProductionOrder.findOne as Mock).mockResolvedValueOnce(mockOrder({ status: 'draft', warehouse_id: null }))
    await expect(releaseProductionOrder('order-1', 'org-1', 'actor-1')).rejects.toThrow('PRODUCTION_ORDER_NO_WAREHOUSE')
    expect(applyMovement).not.toHaveBeenCalled()
  })
})

describe('completeProductionOrder', () => {
  it('produces the finished good, updates cost_price and marks the order done', async () => {
    const order = mockOrder({ status: 'released', planned_quantity: '10.0000' })
    ;(ProductionOrder.findOne as Mock)
      .mockResolvedValueOnce(order)
      .mockResolvedValueOnce({ ...order, status: 'done' })

    const bomWithItems = {
      id: 'bom-1',
      output_quantity: '1',
      items: [{ quantity: '2', scrap_pct: '0', component: { cost_price: '5.00' } }],
    }
    const { default: BillOfMaterials } = await import('./bom.model')
    ;(BillOfMaterials.findOne as Mock).mockResolvedValue(bomWithItems)
    ;(ProductVariant.update as Mock).mockResolvedValue([1])

    await completeProductionOrder('order-1', {}, 'org-1', 'actor-1')

    expect(applyMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        variantId: 'var-finished',
        warehouseId: 'wh-1',
        movementType: 'in',
        referenceType: 'production_order',
        quantityDelta: expect.any(Decimal),
      }),
      T,
    )
    expect((applyMovement as Mock).mock.calls[0][0].quantityDelta.toString()).toBe('10')
    expect(ProductVariant.update).toHaveBeenCalledWith(
      { cost_price: '12.50' },
      { where: { id: 'var-finished' }, transaction: T },
    )
    expect(order.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'done', produced_quantity: '10.0000' }),
      { transaction: T },
    )
  })

  it('uses the custom produced_quantity when provided instead of planned_quantity', async () => {
    const order = mockOrder({ status: 'in_process', planned_quantity: '10.0000' })
    ;(ProductionOrder.findOne as Mock)
      .mockResolvedValueOnce(order)
      .mockResolvedValueOnce({ ...order, status: 'done' })

    const { default: BillOfMaterials } = await import('./bom.model')
    ;(BillOfMaterials.findOne as Mock).mockResolvedValue(null)

    await completeProductionOrder('order-1', { produced_quantity: 7 }, 'org-1', 'actor-1')

    expect((applyMovement as Mock).mock.calls[0][0].quantityDelta.toString()).toBe('7')
    expect(order.update).toHaveBeenCalledWith(
      expect.objectContaining({ produced_quantity: '7.0000' }),
      { transaction: T },
    )
  })

  it('throws PRODUCTION_ORDER_INVALID_STATUS when the order is still draft', async () => {
    ;(ProductionOrder.findOne as Mock).mockResolvedValueOnce(mockOrder({ status: 'draft' }))
    await expect(completeProductionOrder('order-1', {}, 'org-1', 'actor-1')).rejects.toThrow('PRODUCTION_ORDER_INVALID_STATUS')
    expect(applyMovement).not.toHaveBeenCalled()
  })
})

describe('cancelProductionOrder', () => {
  it('flips status with no stock effect when cancelling a draft order', async () => {
    const order = mockOrder({ status: 'draft' })
    ;(ProductionOrder.findOne as Mock)
      .mockResolvedValueOnce(order)
      .mockResolvedValueOnce({ ...order, status: 'cancelled' })

    await cancelProductionOrder('order-1', 'org-1', 'actor-1')

    expect(applyMovement).not.toHaveBeenCalled()
    expect(order.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled' }),
      { transaction: T },
    )
  })

  it('reverses each OUT movement with a compensating IN when cancelling a released order', async () => {
    const order = mockOrder({ status: 'released' })
    ;(ProductionOrder.findOne as Mock)
      .mockResolvedValueOnce(order)
      .mockResolvedValueOnce({ ...order, status: 'cancelled' })

    const movement = { variant_id: 'comp-1', warehouse_id: 'wh-1', quantity_delta: '-4.0000' }
    ;(StockMovement.findAll as Mock).mockResolvedValue([movement])

    await cancelProductionOrder('order-1', 'org-1', 'actor-1')

    expect(applyMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        variantId: 'comp-1',
        warehouseId: 'wh-1',
        movementType: 'in',
        referenceType: 'production_order',
        quantityDelta: expect.any(Decimal),
      }),
      T,
    )
    expect((applyMovement as Mock).mock.calls[0][0].quantityDelta.toString()).toBe('4')
  })

  it('throws PRODUCTION_ORDER_INVALID_STATUS when the order is already done or cancelled', async () => {
    ;(ProductionOrder.findOne as Mock).mockResolvedValueOnce(mockOrder({ status: 'done' }))
    await expect(cancelProductionOrder('order-1', 'org-1', 'actor-1')).rejects.toThrow('PRODUCTION_ORDER_INVALID_STATUS')
  })
})
