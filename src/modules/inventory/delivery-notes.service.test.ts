import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@/lib/db', () => ({
  default: {
    transaction: vi.fn((cb: (t: object) => Promise<unknown>) => cb({})),
  },
}))

vi.mock('@/lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('./delivery-note.model', () => ({
  default: {
    create:   vi.fn(),
    findOne:  vi.fn(),
    findByPk: vi.fn(),
    findAll:  vi.fn(),
  },
  DELIVERY_NOTE_STATUSES: ['draft', 'issued', 'delivered', 'annulled'],
}))

vi.mock('./delivery-note-item.model', () => ({
  default: {
    create:  vi.fn(),
    findAll: vi.fn(),
    destroy: vi.fn(),
  },
}))

vi.mock('./stock-movement.model', () => ({
  default: {
    count:   vi.fn(),
    findAll: vi.fn(),
  },
}))

vi.mock('./stock-movements.service', () => ({
  applyMovement: vi.fn(),
}))

vi.mock('./branch-warehouse.resolution', () => ({
  resolveWarehouseForBranch: vi.fn(),
}))

vi.mock('./delivery-notes.utils', () => ({
  nextDeliveryNumber: vi.fn().mockResolvedValue('RTO-01-0001'),
}))

vi.mock('./delivery-note-associations', () => ({
  ensureDeliveryNoteAssociations: vi.fn(),
}))

vi.mock('@/modules/logistics/carrier-account.model', () => ({
  default: { findOne: vi.fn() },
}))

vi.mock('@/modules/catalog/product-variant.model', () => ({
  default: { findByPk: vi.fn() },
}))

vi.mock('@/modules/catalog/product.model', () => ({
  default: { findByPk: vi.fn() },
}))

vi.mock('@/modules/auth/branch.model', () => ({
  default: { findByPk: vi.fn() },
}))

vi.mock('@/modules/contacts/contact.model', () => ({
  default: { findByPk: vi.fn() },
}))

vi.mock('@/modules/auth/user.model', () => ({
  default: { findByPk: vi.fn() },
}))

vi.mock('./warehouse.model', () => ({
  default: { findByPk: vi.fn() },
}))

vi.mock('@/modules/sales/sales-order.model', () => ({
  default: { findByPk: vi.fn(), findOne: vi.fn() },
}))

vi.mock('@/modules/sales/sales-order-item.model', () => ({
  default: { findAll: vi.fn() },
}))

vi.mock('@/modules/logistics/shipment.model', () => ({
  default: { findOne: vi.fn() },
}))

vi.mock('@/modules/logistics/shipment-item.model', () => ({
  default: { findAll: vi.fn() },
}))

import DeliveryNote from './delivery-note.model'
import DeliveryNoteItem from './delivery-note-item.model'
import StockMovement from './stock-movement.model'
import { applyMovement } from './stock-movements.service'
import { resolveWarehouseForBranch } from './branch-warehouse.resolution'
import {
  createDeliveryNote,
  issueDeliveryNote,
  annulDeliveryNote,
  markDeliveryNoteDelivered,
} from './delivery-notes.service'

const ORG = 'org-1'
const ACTOR = 'actor-1'

beforeEach(() => vi.clearAllMocks())

// ─────────────────────────────────────────────
// createDeliveryNote — deducts_stock inference
// ─────────────────────────────────────────────

describe('createDeliveryNote', () => {
  it('sets deducts_stock=false when linked order already deducted stock on confirm', async () => {
    ;(StockMovement.count as Mock).mockResolvedValue(2) // order has out-movements
    ;(DeliveryNote.create as Mock).mockResolvedValue({ id: 'dn-1' })
    ;(DeliveryNoteItem.create as Mock).mockResolvedValue({})

    await createDeliveryNote(
      {
        branch_id: 'b1',
        order_id:  'ord-1',
        items: [{ description: 'Item', quantity: 5, sort_order: 0 }],
      },
      ORG,
      ACTOR,
    )

    expect(DeliveryNote.create).toHaveBeenCalledWith(
      expect.objectContaining({ deducts_stock: false, order_id: 'ord-1' }),
      expect.anything(),
    )
  })

  it('sets deducts_stock=true when linked order has not deducted stock', async () => {
    ;(StockMovement.count as Mock).mockResolvedValue(0)
    ;(DeliveryNote.create as Mock).mockResolvedValue({ id: 'dn-2' })
    ;(DeliveryNoteItem.create as Mock).mockResolvedValue({})

    await createDeliveryNote(
      {
        branch_id: 'b1',
        order_id:  'ord-2',
        items: [{ description: 'Item', quantity: 5, sort_order: 0 }],
      },
      ORG,
      ACTOR,
    )

    expect(DeliveryNote.create).toHaveBeenCalledWith(
      expect.objectContaining({ deducts_stock: true }),
      expect.anything(),
    )
  })

  it('sets deducts_stock=true for a standalone note (no order)', async () => {
    ;(DeliveryNote.create as Mock).mockResolvedValue({ id: 'dn-3' })
    ;(DeliveryNoteItem.create as Mock).mockResolvedValue({})

    await createDeliveryNote(
      {
        branch_id: 'b1',
        items: [{ description: 'Item', quantity: 1, sort_order: 0 }],
      },
      ORG,
      ACTOR,
    )

    expect(StockMovement.count).not.toHaveBeenCalled()
    expect(DeliveryNote.create).toHaveBeenCalledWith(
      expect.objectContaining({ deducts_stock: true }),
      expect.anything(),
    )
  })
})

// ─────────────────────────────────────────────
// issueDeliveryNote — stock effects
// ─────────────────────────────────────────────

describe('issueDeliveryNote', () => {
  it('applies an out movement per stockable item when deducts_stock=true', async () => {
    const note = {
      id: 'dn-1', status: 'draft', deducts_stock: true,
      warehouse_id: 'wh-1', branch_id: 'b1', delivery_number: 'RTO-01-0001',
      update: vi.fn().mockResolvedValue(undefined),
    }
    ;(DeliveryNote.findOne as Mock).mockResolvedValue(note)
    ;(DeliveryNoteItem.findAll as Mock).mockResolvedValue([
      { variant_id: 'var-1', product_id: 'prod-1', quantity: '5' },
    ])

    const { default: ProductVariant } = await import('@/modules/catalog/product-variant.model')
    ;(ProductVariant.findByPk as Mock).mockResolvedValue({ id: 'var-1', manage_stock: true })
    const { default: Product } = await import('@/modules/catalog/product.model')
    ;(Product.findByPk as Mock).mockResolvedValue({ product_type: 'good' })

    await issueDeliveryNote('dn-1', ORG, ACTOR)

    expect(applyMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        movementType:  'out',
        referenceType: 'delivery_note',
        referenceId:   'dn-1',
        warehouseId:   'wh-1',
      }),
      expect.anything(),
    )
    expect(note.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'issued' }),
      expect.anything(),
    )
  })

  it('does NOT move stock when deducts_stock=false (order already deducted)', async () => {
    const note = {
      id: 'dn-2', status: 'draft', deducts_stock: false,
      warehouse_id: 'wh-1', branch_id: 'b1', delivery_number: 'RTO-01-0002',
      update: vi.fn().mockResolvedValue(undefined),
    }
    ;(DeliveryNote.findOne as Mock).mockResolvedValue(note)

    await issueDeliveryNote('dn-2', ORG, ACTOR)

    expect(applyMovement).not.toHaveBeenCalled()
    expect(DeliveryNoteItem.findAll).not.toHaveBeenCalled()
    expect(note.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'issued' }),
      expect.anything(),
    )
  })

  it('skips service products when deducting stock', async () => {
    const note = {
      id: 'dn-3', status: 'draft', deducts_stock: true,
      warehouse_id: 'wh-1', branch_id: 'b1', delivery_number: 'RTO-01-0003',
      update: vi.fn().mockResolvedValue(undefined),
    }
    ;(DeliveryNote.findOne as Mock).mockResolvedValue(note)
    ;(DeliveryNoteItem.findAll as Mock).mockResolvedValue([
      { variant_id: 'var-svc', product_id: 'prod-svc', quantity: '1' },
    ])
    const { default: ProductVariant } = await import('@/modules/catalog/product-variant.model')
    ;(ProductVariant.findByPk as Mock).mockResolvedValue({ id: 'var-svc', manage_stock: true })
    const { default: Product } = await import('@/modules/catalog/product.model')
    ;(Product.findByPk as Mock).mockResolvedValue({ product_type: 'service' })

    await issueDeliveryNote('dn-3', ORG, ACTOR)

    expect(applyMovement).not.toHaveBeenCalled()
  })

  it('propagates missing branch warehouse when deducting without explicit warehouse', async () => {
    const note = {
      id: 'dn-4', status: 'draft', deducts_stock: true,
      warehouse_id: null, branch_id: 'b1', delivery_number: 'RTO-01-0004',
      update: vi.fn(),
    }
    ;(DeliveryNote.findOne as Mock).mockResolvedValue(note)
    ;(resolveWarehouseForBranch as Mock).mockRejectedValue(
      Object.assign(new Error('not configured'), { code: 'BRANCH_WAREHOUSE_NOT_CONFIGURED' }),
    )

    await expect(issueDeliveryNote('dn-4', ORG, ACTOR)).rejects.toMatchObject({
      code: 'BRANCH_WAREHOUSE_NOT_CONFIGURED',
    })
  })

  it('throws DELIVERY_NOTE_NOT_DRAFT when note is not in draft', async () => {
    ;(DeliveryNote.findOne as Mock).mockResolvedValue({ id: 'dn-5', status: 'issued' })
    await expect(issueDeliveryNote('dn-5', ORG, ACTOR)).rejects.toThrow('DELIVERY_NOTE_NOT_DRAFT')
  })
})

// ─────────────────────────────────────────────
// annulDeliveryNote — stock restoration
// ─────────────────────────────────────────────

describe('annulDeliveryNote', () => {
  it('restores stock with a compensating in movement when deducts_stock=true', async () => {
    const note = {
      id: 'dn-1', status: 'issued', deducts_stock: true, delivery_number: 'RTO-01-0001',
      update: vi.fn().mockResolvedValue(undefined),
    }
    ;(DeliveryNote.findOne as Mock).mockResolvedValue(note)
    ;(StockMovement.findAll as Mock).mockResolvedValue([
      { variant_id: 'var-1', warehouse_id: 'wh-1', quantity_delta: '-5.0000' },
    ])

    await annulDeliveryNote('dn-1', ORG, ACTOR)

    expect(applyMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        movementType:  'in',
        referenceType: 'delivery_note',
        quantityDelta: expect.objectContaining({}), // Decimal
      }),
      expect.anything(),
    )
    expect(note.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'annulled' }),
      expect.anything(),
    )
  })

  it('does NOT restore stock when deducts_stock=false', async () => {
    const note = {
      id: 'dn-2', status: 'delivered', deducts_stock: false, delivery_number: 'RTO-01-0002',
      update: vi.fn().mockResolvedValue(undefined),
    }
    ;(DeliveryNote.findOne as Mock).mockResolvedValue(note)

    await annulDeliveryNote('dn-2', ORG, ACTOR)

    expect(StockMovement.findAll).not.toHaveBeenCalled()
    expect(applyMovement).not.toHaveBeenCalled()
    expect(note.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'annulled' }),
      expect.anything(),
    )
  })

  it('throws DELIVERY_NOTE_NOT_ANNULLABLE for a draft note', async () => {
    ;(DeliveryNote.findOne as Mock).mockResolvedValue({ id: 'dn-3', status: 'draft' })
    await expect(annulDeliveryNote('dn-3', ORG, ACTOR)).rejects.toThrow('DELIVERY_NOTE_NOT_ANNULLABLE')
  })
})

// ─────────────────────────────────────────────
// markDeliveryNoteDelivered
// ─────────────────────────────────────────────

describe('markDeliveryNoteDelivered', () => {
  it('moves an issued note to delivered and stamps a delivery date', async () => {
    const note = {
      id: 'dn-1', status: 'issued', delivery_date: null,
      update: vi.fn().mockResolvedValue(undefined),
    }
    ;(DeliveryNote.findOne as Mock).mockResolvedValue(note)

    await markDeliveryNoteDelivered('dn-1', ORG, ACTOR)

    expect(note.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'delivered', delivery_date: expect.any(Date) }),
      expect.anything(),
    )
  })

  it('throws DELIVERY_NOTE_NOT_ISSUED when not issued', async () => {
    ;(DeliveryNote.findOne as Mock).mockResolvedValue({ id: 'dn-2', status: 'draft' })
    await expect(markDeliveryNoteDelivered('dn-2', ORG, ACTOR)).rejects.toThrow('DELIVERY_NOTE_NOT_ISSUED')
  })
})
