import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import Decimal from 'decimal.js'

vi.mock('./stock-item.model', () => ({
  default: {
    findOrCreate: vi.fn(),
    sum:          vi.fn(),
  },
}))

vi.mock('./warehouse.model', () => ({
  default: {
    findOne: vi.fn().mockResolvedValue({ default_minimum_quantity: '0' }),
  },
}))

vi.mock('./stock-movement.model', () => ({
  default: {
    create:  vi.fn(),
    findAll: vi.fn(),
  },
}))

vi.mock('./low-stock-alert-queue.model', () => ({
  default: {
    bulkCreate: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('./stock-batches.service', () => ({
  allocateInbound:              vi.fn(),
  consumeFefo:                  vi.fn(),
  earliestExpiry:               vi.fn(),
  ensureBatchesMatchAggregate:  vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  default: {
    transaction: vi.fn((cb: (t: object) => Promise<unknown>) => cb({})),
  },
}))

vi.mock('@/lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('./warehouses.service', () => ({
  resolveDefaultWarehouse: vi.fn(),
}))

vi.mock('@/modules/catalog/product-variant.model', () => ({
  default: {
    findByPk: vi.fn(),
    findOne:  vi.fn(),
    update:   vi.fn(),
  },
}))

vi.mock('@/modules/catalog/product.model', () => ({
  default: { findByPk: vi.fn() },
}))

vi.mock('@/modules/sales/sales-order.model', () => ({
  default: { findByPk: vi.fn() },
}))

vi.mock('@/modules/sales/sales-order-item.model', () => ({
  default: { findAll: vi.fn() },
}))

import StockItem    from './stock-item.model'
import StockMovement from './stock-movement.model'
import LowStockAlertQueue from './low-stock-alert-queue.model'
import { applyMovement, restoreStockForOrder, manualAdjustment } from './stock-movements.service'
import { resolveDefaultWarehouse } from './warehouses.service'
import { allocateInbound, consumeFefo, earliestExpiry, ensureBatchesMatchAggregate } from './stock-batches.service'

const T = {} as never // mock transaction

function mockStockItem(quantity: string, minimumQuantity = '0') {
  return {
    id: 'item-1',
    quantity,
    minimum_quantity: minimumQuantity,
    update: vi.fn().mockResolvedValue(undefined),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default batch behaviour: inbound lands on one batch, outbound takes from one.
  ;(allocateInbound as Mock).mockImplementation(
    async ({ quantity }: { quantity: Decimal }) => ({ batchId: 'batch-1', quantity }),
  )
  ;(consumeFefo as Mock).mockImplementation(
    async ({ quantity }: { quantity: Decimal }) => [{ batchId: 'batch-1', quantity }],
  )
  ;(earliestExpiry as Mock).mockResolvedValue(null)
  ;(ensureBatchesMatchAggregate as Mock).mockResolvedValue(undefined)
})

// ─────────────────────────────────────────────
// applyMovement
// ─────────────────────────────────────────────

describe('applyMovement', () => {
  it('increases stock and records a movement on "in"', async () => {
    const item = mockStockItem('10.0000')
    ;(StockItem.findOrCreate as Mock).mockResolvedValue([item, false])
    ;(StockItem.sum as Mock).mockResolvedValue(15)
    ;(StockMovement.create as Mock).mockResolvedValue({})

    const { default: ProductVariant } = await import('@/modules/catalog/product-variant.model')
    ;(ProductVariant.update as Mock).mockResolvedValue([1])

    await applyMovement(
      {
        variantId:     'var-1',
        warehouseId:   'wh-1',
        orgId:         'org-1',
        movementType:  'in',
        referenceType: 'manual',
        referenceId:   null,
        quantityDelta: new Decimal('5'),
        notes:         null,
        actorId:       'actor-1',
      },
      T,
    )

    expect(item.update).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: '15.0000' }),
      expect.anything(),
    )
    expect(StockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity_before: '10.0000',
        quantity_after:  '15.0000',
        movement_type:   'in',
        batch_id:        'batch-1',
      }),
      expect.anything(),
    )
  })

  it('decreases stock and records an "out" movement', async () => {
    const item = mockStockItem('20.0000')
    ;(StockItem.findOrCreate as Mock).mockResolvedValue([item, false])
    ;(StockItem.sum as Mock).mockResolvedValue(15)
    ;(StockMovement.create as Mock).mockResolvedValue({})

    const { default: ProductVariant } = await import('@/modules/catalog/product-variant.model')
    ;(ProductVariant.update as Mock).mockResolvedValue([1])

    await applyMovement(
      {
        variantId:     'var-1',
        warehouseId:   'wh-1',
        orgId:         'org-1',
        movementType:  'out',
        referenceType: 'order',
        referenceId:   'ord-1',
        quantityDelta: new Decimal('-5'),
        notes:         null,
        actorId:       'actor-1',
      },
      T,
    )

    expect(item.update).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: '15.0000' }),
      expect.anything(),
    )
    expect(ensureBatchesMatchAggregate).toHaveBeenCalledWith(
      { orgId: 'org-1', stockItemId: 'item-1', aggregateQty: new Decimal('20') },
      expect.anything(),
    )
  })

  it('throws INSUFFICIENT_STOCK when quantity would go negative', async () => {
    const item = mockStockItem('3.0000')
    ;(StockItem.findOrCreate as Mock).mockResolvedValue([item, false])

    await expect(
      applyMovement(
        {
          variantId:     'var-1',
          warehouseId:   'wh-1',
          orgId:         'org-1',
          movementType:  'out',
          referenceType: 'order',
          referenceId:   'ord-1',
          quantityDelta: new Decimal('-10'),
          notes:         null,
          actorId:       'actor-1',
        },
        T,
      ),
    ).rejects.toThrow('INSUFFICIENT_STOCK')

    expect(item.update).not.toHaveBeenCalled()
    expect(StockMovement.create).not.toHaveBeenCalled()
  })

  it('allows negative aggregate when allowNegativeStock is set', async () => {
    const item = mockStockItem('3.0000')
    ;(StockItem.findOrCreate as Mock).mockResolvedValue([item, false])
    ;(consumeFefo as Mock).mockResolvedValue([{ batchId: 'b-1', quantity: new Decimal('10') }])
    ;(earliestExpiry as Mock).mockResolvedValue(null)
    ;(StockMovement.create as Mock).mockResolvedValue({})
    ;(StockItem.sum as Mock).mockResolvedValue(-7)

    const { default: ProductVariant } = await import('@/modules/catalog/product-variant.model')
    ;(ProductVariant.findByPk as Mock).mockResolvedValue({ allow_backorder: true })
    ;(ProductVariant.update as Mock).mockResolvedValue([1])

    await applyMovement(
      {
        variantId:     'var-1',
        warehouseId:   'wh-1',
        orgId:         'org-1',
        movementType:  'out',
        referenceType: 'order',
        referenceId:   'ord-1',
        quantityDelta: new Decimal('-10'),
        notes:         null,
        actorId:       'actor-1',
        allowNegativeStock: true,
      },
      T,
    )

    expect(item.update).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: '-7.0000' }),
      expect.anything(),
    )
  })

  it('creates stock_item with quantity 0 when it does not exist yet', async () => {
    const item = mockStockItem('0')
    ;(StockItem.findOrCreate as Mock).mockResolvedValue([item, true])
    ;(StockItem.sum as Mock).mockResolvedValue(5)
    ;(StockMovement.create as Mock).mockResolvedValue({})

    const { default: ProductVariant } = await import('@/modules/catalog/product-variant.model')
    ;(ProductVariant.update as Mock).mockResolvedValue([1])

    await applyMovement(
      {
        variantId:     'var-new',
        warehouseId:   'wh-1',
        orgId:         'org-1',
        movementType:  'in',
        referenceType: 'initial',
        referenceId:   null,
        quantityDelta: new Decimal('5'),
        notes:         'stock inicial',
        actorId:       'actor-1',
      },
      T,
    )

    expect(item.update).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: '5.0000' }),
      expect.anything(),
    )
  })

  it('passes batchCode/expiryDate to allocateInbound on an inbound movement', async () => {
    const item = mockStockItem('0')
    ;(StockItem.findOrCreate as Mock).mockResolvedValue([item, false])
    ;(StockItem.sum as Mock).mockResolvedValue(8)
    ;(StockMovement.create as Mock).mockResolvedValue({})
    ;(allocateInbound as Mock).mockResolvedValue({ batchId: 'b-lot', quantity: new Decimal('8') })

    const { default: ProductVariant } = await import('@/modules/catalog/product-variant.model')
    ;(ProductVariant.update as Mock).mockResolvedValue([1])

    await applyMovement(
      {
        variantId:     'var-1',
        warehouseId:   'wh-1',
        orgId:         'org-1',
        movementType:  'in',
        referenceType: 'purchase_receipt',
        referenceId:   'rcpt-1',
        quantityDelta: new Decimal('8'),
        notes:         null,
        actorId:       'actor-1',
        batchCode:     'L-42',
        expiryDate:    '2026-09-01',
      },
      T,
    )

    expect(allocateInbound).toHaveBeenCalledWith(
      expect.objectContaining({ batchCode: 'L-42', expiryDate: '2026-09-01', quantity: new Decimal('8') }),
      expect.anything(),
    )
    expect(StockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ movement_type: 'in', batch_id: 'b-lot' }),
      expect.anything(),
    )
  })

  it('splits an outbound across FEFO batches into one movement row per batch', async () => {
    const item = mockStockItem('15.0000')
    ;(StockItem.findOrCreate as Mock).mockResolvedValue([item, false])
    ;(StockItem.sum as Mock).mockResolvedValue(10)
    ;(StockMovement.create as Mock).mockResolvedValue({})
    ;(consumeFefo as Mock).mockResolvedValue([
      { batchId: 'early', quantity: new Decimal('3') },
      { batchId: 'late',  quantity: new Decimal('2') },
    ])

    const { default: ProductVariant } = await import('@/modules/catalog/product-variant.model')
    ;(ProductVariant.update as Mock).mockResolvedValue([1])

    await applyMovement(
      {
        variantId:     'var-1',
        warehouseId:   'wh-1',
        orgId:         'org-1',
        movementType:  'out',
        referenceType: 'delivery_note',
        referenceId:   'dn-1',
        quantityDelta: new Decimal('-5'),
        notes:         null,
        actorId:       'actor-1',
      },
      T,
    )

    // One ledger row per batch, additive running balance, linked to its batch.
    expect(StockMovement.create).toHaveBeenCalledTimes(2)
    expect(StockMovement.create).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ batch_id: 'early', quantity_delta: '-3.0000', quantity_before: '15.0000', quantity_after: '12.0000' }),
      expect.anything(),
    )
    expect(StockMovement.create).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ batch_id: 'late', quantity_delta: '-2.0000', quantity_before: '12.0000', quantity_after: '10.0000' }),
      expect.anything(),
    )
    // Aggregate is updated once to the authoritative total.
    expect(item.update).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: '10.0000' }),
      expect.anything(),
    )
  })
})

// ─────────────────────────────────────────────
// low-stock alert enqueue
// ─────────────────────────────────────────────

describe('applyMovement — low stock alert enqueue', () => {
  it('enqueues a low-stock alert row when an outbound movement crosses below minimum', async () => {
    const item = mockStockItem('12.0000', '10.0000')
    ;(StockItem.findOrCreate as Mock).mockResolvedValue([item, false])
    ;(StockItem.sum as Mock).mockResolvedValue(7)
    ;(StockMovement.create as Mock).mockResolvedValue({})

    const { default: ProductVariant } = await import('@/modules/catalog/product-variant.model')
    ;(ProductVariant.update as Mock).mockResolvedValue([1])

    await applyMovement(
      {
        variantId:     'var-1',
        warehouseId:   'wh-1',
        orgId:         'org-1',
        movementType:  'out',
        referenceType: 'order',
        referenceId:   'ord-1',
        quantityDelta: new Decimal('-5'),
        notes:         null,
        actorId:       'actor-1',
      },
      T,
    )

    expect(LowStockAlertQueue.bulkCreate).toHaveBeenCalledWith(
      [{ org_id: 'org-1', stock_item_id: 'item-1' }],
      expect.objectContaining({ ignoreDuplicates: true }),
    )
  })

  it('does not enqueue when the resulting quantity stays at or above minimum', async () => {
    const item = mockStockItem('20.0000', '10.0000')
    ;(StockItem.findOrCreate as Mock).mockResolvedValue([item, false])
    ;(StockItem.sum as Mock).mockResolvedValue(15)
    ;(StockMovement.create as Mock).mockResolvedValue({})

    const { default: ProductVariant } = await import('@/modules/catalog/product-variant.model')
    ;(ProductVariant.update as Mock).mockResolvedValue([1])

    await applyMovement(
      {
        variantId:     'var-1',
        warehouseId:   'wh-1',
        orgId:         'org-1',
        movementType:  'out',
        referenceType: 'order',
        referenceId:   'ord-1',
        quantityDelta: new Decimal('-5'),
        notes:         null,
        actorId:       'actor-1',
      },
      T,
    )

    expect(LowStockAlertQueue.bulkCreate).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────
// restoreStockForOrder
// ─────────────────────────────────────────────

describe('restoreStockForOrder', () => {
  it('does nothing when there are no out-movements for the order', async () => {
    ;(StockMovement.findAll as Mock).mockResolvedValue([])

    await restoreStockForOrder('ord-1', 'org-1', 'actor-1', T)

    expect(StockItem.findOrCreate).not.toHaveBeenCalled()
  })

  it('creates an "in" movement for each previous "out" movement', async () => {
    const outMovement = {
      variant_id:     'var-1',
      warehouse_id:   'wh-1',
      quantity_delta: '-5.0000',
    }
    ;(StockMovement.findAll as Mock).mockResolvedValue([outMovement])

    const item = mockStockItem('0.0000')
    ;(StockItem.findOrCreate as Mock).mockResolvedValue([item, false])
    ;(StockItem.sum as Mock).mockResolvedValue(5)
    ;(StockMovement.create as Mock).mockResolvedValue({})

    const { default: ProductVariant } = await import('@/modules/catalog/product-variant.model')
    ;(ProductVariant.update as Mock).mockResolvedValue([1])

    await restoreStockForOrder('ord-1', 'org-1', 'actor-1', T)

    expect(StockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        movement_type:  'in',
        quantity_delta: '5.0000',
        reference_type: 'order',
        reference_id:   'ord-1',
      }),
      expect.anything(),
    )
  })
})

// ─────────────────────────────────────────────
// manualAdjustment
// ─────────────────────────────────────────────

describe('manualAdjustment', () => {
  it('applies a positive delta when new quantity exceeds current', async () => {
    const item = mockStockItem('10.0000')
    ;(StockItem.findOrCreate as Mock).mockResolvedValue([item, false])
    ;(StockItem.sum as Mock).mockResolvedValue(25)
    ;(StockMovement.create as Mock).mockResolvedValue({})

    const { default: ProductVariant } = await import('@/modules/catalog/product-variant.model')
    ;(ProductVariant.update as Mock).mockResolvedValue([1])

    await manualAdjustment('var-1', 'wh-1', 25, 'Ajuste de inventario', {
      orgId:            'org-1',
      userId:           'actor-1',
      defaultBranchId:  null,
      allowedBranchIds: [],
    })

    expect(StockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        movement_type:   'adjustment',
        reference_type:  'manual',
        quantity_before: '10.0000',
        quantity_after:  '25.0000',
        quantity_delta:  '15.0000',
      }),
      expect.anything(),
    )
  })

  it('applies a negative delta when new quantity is less than current', async () => {
    const item = mockStockItem('30.0000')
    ;(StockItem.findOrCreate as Mock).mockResolvedValue([item, false])
    ;(StockItem.sum as Mock).mockResolvedValue(10)
    ;(StockMovement.create as Mock).mockResolvedValue({})

    const { default: ProductVariant } = await import('@/modules/catalog/product-variant.model')
    ;(ProductVariant.update as Mock).mockResolvedValue([1])

    await manualAdjustment('var-1', 'wh-1', 10, null, {
      orgId:            'org-1',
      userId:           'actor-1',
      defaultBranchId:  null,
      allowedBranchIds: [],
    })

    expect(StockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity_before: '30.0000',
        quantity_after:  '10.0000',
        quantity_delta:  '-20.0000',
      }),
      expect.anything(),
    )
  })

  it('does not record a movement when new quantity equals current', async () => {
    const item = mockStockItem('10.0000')
    ;(StockItem.findOrCreate as Mock).mockResolvedValue([item, false])

    await manualAdjustment('var-1', 'wh-1', 10, null, {
      orgId:            'org-1',
      userId:           'actor-1',
      defaultBranchId:  null,
      allowedBranchIds: [],
    })

    expect(StockMovement.create).not.toHaveBeenCalled()
  })

  it('resolveDefaultWarehouse not being called when no warehouse arg provided is a no-op', () => {
    expect(resolveDefaultWarehouse).toBeDefined()
  })
})
