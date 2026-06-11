import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import Decimal from 'decimal.js'

vi.mock('@/lib/db', () => ({ default: {} }))

vi.mock('./stock-item.model', () => ({ default: {} }))

vi.mock('./stock-item-batch.model', () => ({
  default: {
    findOne: vi.fn(),
    findAll: vi.fn(),
    create:  vi.fn(),
  },
}))

import StockItemBatch from './stock-item-batch.model'
import { allocateInbound, consumeFefo } from './stock-batches.service'

const T = {} as never

function batch(over: Partial<{ id: string; batch_code: string | null; expiry_date: string | null; quantity: string }>) {
  return {
    id:          over.id ?? 'b',
    batch_code:  over.batch_code ?? null,
    expiry_date: over.expiry_date ?? null,
    quantity:    over.quantity ?? '0',
    update:      vi.fn().mockResolvedValue(undefined),
  }
}

beforeEach(() => vi.clearAllMocks())

// ─────────────────────────────────────────────
// allocateInbound
// ─────────────────────────────────────────────

describe('allocateInbound', () => {
  it('creates a new named batch when the lot code is unseen', async () => {
    ;(StockItemBatch.findOne as Mock).mockResolvedValue(null)
    ;(StockItemBatch.create as Mock).mockResolvedValue({ id: 'new-batch' })

    const alloc = await allocateInbound(
      { orgId: 'org-1', stockItemId: 'item-1', quantity: new Decimal('10'), batchCode: 'L-001', expiryDate: '2026-12-01' },
      T,
    )

    expect(StockItemBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({ batch_code: 'L-001', expiry_date: '2026-12-01', quantity: '10.0000' }),
      expect.anything(),
    )
    expect(alloc).toEqual({ batchId: 'new-batch', quantity: new Decimal('10') })
  })

  it('adds to an existing named batch, keeping its original expiry', async () => {
    const existing = batch({ id: 'b1', batch_code: 'L-001', expiry_date: '2026-12-01', quantity: '4' })
    ;(StockItemBatch.findOne as Mock).mockResolvedValue(existing)

    const alloc = await allocateInbound(
      { orgId: 'org-1', stockItemId: 'item-1', quantity: new Decimal('6'), batchCode: 'L-001', expiryDate: '2027-01-01' },
      T,
    )

    expect(existing.update).toHaveBeenCalledWith({ quantity: '10.0000' }, expect.anything())
    expect(StockItemBatch.create).not.toHaveBeenCalled()
    expect(alloc).toEqual({ batchId: 'b1', quantity: new Decimal('6') })
  })

  it('lands on the legacy/default batch when no code and no expiry are given', async () => {
    const def = batch({ id: 'def', batch_code: null, expiry_date: null, quantity: '2' })
    ;(StockItemBatch.findOne as Mock).mockResolvedValue(def)

    await allocateInbound(
      { orgId: 'org-1', stockItemId: 'item-1', quantity: new Decimal('3'), batchCode: null, expiryDate: null },
      T,
    )

    expect(def.update).toHaveBeenCalledWith({ quantity: '5.0000' }, expect.anything())
  })
})

// ─────────────────────────────────────────────
// consumeFefo
// ─────────────────────────────────────────────

describe('consumeFefo', () => {
  it('consumes a single batch when it covers the request', async () => {
    const b = batch({ id: 'b1', expiry_date: '2026-01-01', quantity: '10' })
    ;(StockItemBatch.findAll as Mock).mockResolvedValue([b])

    const allocs = await consumeFefo({ stockItemId: 'item-1', quantity: new Decimal('4') }, T)

    expect(b.update).toHaveBeenCalledWith({ quantity: '6.0000' }, expect.anything())
    expect(allocs).toEqual([{ batchId: 'b1', quantity: new Decimal('4') }])
  })

  it('splits across batches in expiry order (earliest first)', async () => {
    // findAll returns FEFO-ordered rows (earliest expiry first); the service relies on the SQL order.
    const early = batch({ id: 'early', expiry_date: '2026-01-01', quantity: '3' })
    const late  = batch({ id: 'late',  expiry_date: '2026-06-01', quantity: '10' })
    ;(StockItemBatch.findAll as Mock).mockResolvedValue([early, late])

    const allocs = await consumeFefo({ stockItemId: 'item-1', quantity: new Decimal('5') }, T)

    // Drains the earliest batch fully, then takes the remainder from the next.
    expect(early.update).toHaveBeenCalledWith({ quantity: '0.0000' }, expect.anything())
    expect(late.update).toHaveBeenCalledWith({ quantity: '8.0000' }, expect.anything())
    expect(allocs).toEqual([
      { batchId: 'early', quantity: new Decimal('3') },
      { batchId: 'late',  quantity: new Decimal('2') },
    ])
  })

  it('treats NULL-expiry batches as last (ordered by SQL, drained only after dated ones)', async () => {
    const dated   = batch({ id: 'dated',   expiry_date: '2026-01-01', quantity: '2' })
    const undated = batch({ id: 'undated', expiry_date: null,         quantity: '10' })
    ;(StockItemBatch.findAll as Mock).mockResolvedValue([dated, undated])

    const allocs = await consumeFefo({ stockItemId: 'item-1', quantity: new Decimal('5') }, T)

    expect(allocs).toEqual([
      { batchId: 'dated',   quantity: new Decimal('2') },
      { batchId: 'undated', quantity: new Decimal('3') },
    ])
  })

  it('skips empty batches and uses the next one', async () => {
    const empty = batch({ id: 'empty', expiry_date: '2026-01-01', quantity: '0' })
    const full  = batch({ id: 'full',  expiry_date: '2026-02-01', quantity: '10' })
    ;(StockItemBatch.findAll as Mock).mockResolvedValue([empty, full])

    const allocs = await consumeFefo({ stockItemId: 'item-1', quantity: new Decimal('4') }, T)

    expect(empty.update).not.toHaveBeenCalled()
    expect(allocs).toEqual([{ batchId: 'full', quantity: new Decimal('4') }])
  })

  it('throws INSUFFICIENT_STOCK when batches cannot cover the request', async () => {
    const b = batch({ id: 'b1', expiry_date: '2026-01-01', quantity: '3' })
    ;(StockItemBatch.findAll as Mock).mockResolvedValue([b])

    await expect(
      consumeFefo({ stockItemId: 'item-1', quantity: new Decimal('10') }, T),
    ).rejects.toThrow('INSUFFICIENT_STOCK')
  })
})
