import 'server-only'
import Decimal from 'decimal.js'
import { Op, literal } from 'sequelize'
import type { Transaction } from 'sequelize'
import StockItemBatch from './stock-item-batch.model'

/**
 * Batch (lote) allocation primitives for FEFO traceability.
 *
 * These helpers operate over the `stock_item_batches` rows under a single
 * `stock_items` aggregate. They NEVER touch `stock_items.quantity` — the caller
 * (`applyMovement`) owns the aggregate and updates it atomically in the same
 * transaction. All callers must hold the stock_item row lock first.
 */

export interface BatchAllocation {
  /** The batch row id the quantity landed on / was taken from. */
  batchId: string
  /** Absolute quantity allocated to this batch (always positive). */
  quantity: Decimal
}

/**
 * Adds `quantity` (positive) to a batch under `stockItemId`.
 *
 * - With a `batchCode`, finds the live batch with that code (creating it if
 *   absent). `expiryDate` is recorded on creation; if the batch already exists
 *   with a different/empty expiry, the existing expiry is kept (a lot code is
 *   the identity — its expiry is fixed at first sight).
 * - Without a `batchCode` AND without an `expiryDate`, lands on the single
 *   legacy/default batch (batch_code IS NULL), creating it if needed. This is
 *   the pre-batch behaviour.
 * - Without a `batchCode` but WITH an `expiryDate`, treats the expiry as the
 *   batch identity (anonymous dated lot): reuses a live, code-less batch with
 *   the same expiry if present, else creates one.
 *
 * Returns the single allocation produced.
 */
export async function allocateInbound(
  params: {
    orgId: string
    stockItemId: string
    quantity: Decimal
    batchCode: string | null
    expiryDate: string | null
  },
  t: Transaction,
): Promise<BatchAllocation> {
  const { orgId, stockItemId, quantity, batchCode, expiryDate } = params

  let batch: StockItemBatch | null = null

  if (batchCode) {
    batch = await StockItemBatch.findOne({
      where: { stock_item_id: stockItemId, batch_code: batchCode },
      transaction: t,
      lock: true,
    })
  } else if (expiryDate) {
    // Anonymous dated lot: identity is (no code, this expiry).
    batch = await StockItemBatch.findOne({
      where: { stock_item_id: stockItemId, batch_code: { [Op.is]: null }, expiry_date: expiryDate },
      transaction: t,
      lock: true,
    })
  } else {
    // Legacy/default batch: the single code-less catch-all per stock_item
    // (guaranteed unique by uq_stock_item_batches_default). It may carry an
    // expiry set via the alerts form — that is fine, it is still the default.
    batch = await StockItemBatch.findOne({
      where: { stock_item_id: stockItemId, batch_code: { [Op.is]: null } },
      transaction: t,
      lock: true,
    })
  }

  if (!batch) {
    batch = await StockItemBatch.create(
      {
        org_id:        orgId,
        stock_item_id: stockItemId,
        batch_code:    batchCode,
        expiry_date:   expiryDate,
        quantity:      quantity.toFixed(4),
      },
      { transaction: t },
    )
    return { batchId: batch.id, quantity }
  }

  const next = new Decimal(batch.quantity).plus(quantity)
  await batch.update({ quantity: next.toFixed(4) }, { transaction: t })
  return { batchId: batch.id, quantity }
}

/**
 * Consumes `quantity` (positive) from batches under `stockItemId` in FEFO order:
 * earliest `expiry_date` first, NULL expiry last, tie-broken by oldest
 * `created_at`. Splits across batches as needed.
 *
 * Throws `INSUFFICIENT_STOCK` if the live batches cannot cover the request
 * (the aggregate check in `applyMovement` should catch this first, but this is
 * the authoritative per-batch guard).
 *
 * Returns one allocation per batch touched (positive quantities).
 */
export async function consumeFefo(
  params: { stockItemId: string; quantity: Decimal },
  t: Transaction,
): Promise<BatchAllocation[]> {
  const { stockItemId, quantity } = params

  const batches = await StockItemBatch.findAll({
    where: { stock_item_id: stockItemId },
    order: [
      // FEFO: earliest expiry first, NULL expiry last, then oldest created_at.
      literal('expiry_date ASC NULLS LAST'),
      ['created_at', 'ASC'],
    ],
    transaction: t,
    lock: true,
  })

  let remaining = quantity
  const allocations: BatchAllocation[] = []

  for (const batch of batches) {
    if (remaining.lte(0)) break
    const available = new Decimal(batch.quantity)
    if (available.lte(0)) continue

    const take = Decimal.min(available, remaining)
    const next = available.minus(take)
    await batch.update({ quantity: next.toFixed(4) }, { transaction: t })
    allocations.push({ batchId: batch.id, quantity: take })
    remaining = remaining.minus(take)
  }

  if (remaining.gt(0)) {
    throw new Error('INSUFFICIENT_STOCK')
  }

  return allocations
}

/**
 * Repairs legacy rows where `stock_items.quantity` was set without matching
 * batch rows (e.g. dev seed). Puts any orphan quantity on the default batch so
 * outbound FEFO consumption can proceed.
 */
export async function ensureBatchesMatchAggregate(
  params: { orgId: string; stockItemId: string; aggregateQty: Decimal },
  t: Transaction,
): Promise<void> {
  const { orgId, stockItemId, aggregateQty } = params

  const batches = await StockItemBatch.findAll({
    where: { stock_item_id: stockItemId },
    transaction: t,
    lock: true,
  })

  const batchSum = batches.reduce((sum, b) => sum.plus(b.quantity), new Decimal(0))
  const orphan = aggregateQty.minus(batchSum)
  if (orphan.lte(0)) return

  const defaultBatch = batches.find(b => b.batch_code === null)
  if (!defaultBatch) {
    await StockItemBatch.create(
      {
        org_id:        orgId,
        stock_item_id: stockItemId,
        batch_code:    null,
        expiry_date:   null,
        quantity:      orphan.toFixed(4),
      },
      { transaction: t },
    )
    return
  }

  const next = new Decimal(defaultBatch.quantity).plus(orphan)
  await defaultBatch.update({ quantity: next.toFixed(4) }, { transaction: t })
}

/** Returns the earliest expiry_date among live, positive-qty batches, or null. */
export async function earliestExpiry(stockItemId: string, t: Transaction): Promise<string | null> {
  const batch = await StockItemBatch.findOne({
    where: { stock_item_id: stockItemId, expiry_date: { [Op.not]: null }, quantity: { [Op.gt]: 0 } },
    order: [['expiry_date', 'ASC']],
    attributes: ['expiry_date'],
    transaction: t,
  })
  return batch?.expiry_date ?? null
}
