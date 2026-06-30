import 'server-only'
import { randomUUID } from 'crypto'
import Decimal from 'decimal.js'
import { Op } from 'sequelize'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import type { TenantContext } from '@/lib/tenancy'
import { TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import ProductVariant from '@/modules/catalog/product-variant.model'
import StockItem from './stock-item.model'
import { applyMovement } from './stock-movements.service'
import type { StockTransferAllInput, StockTransferBatchInput, StockTransferInput } from './stock-transfer.schema'
import { getWarehouse } from './warehouses.service'

function assertWarehouseBranchAllowed(ctx: TenantContext, warehouseBranchId: string | null) {
  if (ctx.allowedBranchIds.length === 0) return
  if (!warehouseBranchId || !ctx.allowedBranchIds.includes(warehouseBranchId)) {
    throw new TenancyError(TENANCY_ERROR_CODES.BRANCH_NOT_ALLOWED)
  }
}

async function assertWarehouses(ctx: TenantContext, fromId: string, toId: string) {
  const [fromWh, toWh] = await Promise.all([
    getWarehouse(fromId, ctx.orgId),
    getWarehouse(toId, ctx.orgId),
  ])
  assertWarehouseBranchAllowed(ctx, fromWh.branch_id)
  assertWarehouseBranchAllowed(ctx, toWh.branch_id)
  if (!fromWh.is_active || !toWh.is_active) throw new Error('WAREHOUSE_INACTIVE')
  return { fromWh, toWh }
}

async function assertVariantTracksStock(variantId: string, orgId: string) {
  const variant = await ProductVariant.findOne({
    where: { id: variantId, org_id: orgId },
    attributes: ['id', 'manage_stock'],
  })
  if (!variant) throw new Error('VARIANT_NOT_FOUND')
  if (!variant.manage_stock) throw new Error('VARIANT_STOCK_NOT_MANAGED')
  return variant
}

export async function transferStock(input: StockTransferInput, ctx: TenantContext): Promise<{ transfer_id: string }> {
  await assertVariantTracksStock(input.variant_id, ctx.orgId)
  await assertWarehouses(ctx, input.from_warehouse_id, input.to_warehouse_id)

  const transferId = randomUUID()
  const qty = new Decimal(input.quantity)
  const notes = input.notes?.trim() || null

  await sequelize.transaction(async (t) => {
    await applyMovement({
      variantId:     input.variant_id,
      warehouseId:   input.from_warehouse_id,
      orgId:         ctx.orgId,
      movementType:  'transfer_out',
      referenceType: 'transfer',
      referenceId:   transferId,
      quantityDelta: qty.negated(),
      notes,
      actorId:       ctx.userId,
    }, t)

    await applyMovement({
      variantId:     input.variant_id,
      warehouseId:   input.to_warehouse_id,
      orgId:         ctx.orgId,
      movementType:  'transfer_in',
      referenceType: 'transfer',
      referenceId:   transferId,
      quantityDelta: qty,
      notes,
      actorId:       ctx.userId,
    }, t)
  })

  logger.info({
    transferId,
    variantId: input.variant_id,
    from: input.from_warehouse_id,
    to: input.to_warehouse_id,
    quantity: qty.toFixed(4),
    orgId: ctx.orgId,
    actorId: ctx.userId,
  }, 'stock transferred')

  return { transfer_id: transferId }
}

export interface TransferAllResult {
  transfer_id: string
  moved_variants: number
  skipped_variants: number
}

/** Mueve todo el stock con cantidad > 0 del depósito origen al destino (por variante). */
export async function transferAllStock(input: StockTransferAllInput, ctx: TenantContext): Promise<TransferAllResult> {
  await assertWarehouses(ctx, input.from_warehouse_id, input.to_warehouse_id)

  const items = await StockItem.findAll({
    where: {
      org_id:       ctx.orgId,
      warehouse_id: input.from_warehouse_id,
      quantity:     { [Op.gt]: 0 },
    },
    attributes: ['variant_id', 'quantity'],
    limit: 5000,
  })

  const transferId = randomUUID()
  const notes = input.notes?.trim() || 'Transferencia masiva entre depósitos'
  let moved = 0
  let skipped = 0

  await sequelize.transaction(async (t) => {
    for (const item of items) {
      try {
        await assertVariantTracksStock(item.variant_id, ctx.orgId)
      } catch {
        skipped++
        continue
      }

      const qty = new Decimal(item.quantity)
      if (qty.lte(0)) {
        skipped++
        continue
      }

      await applyMovement({
        variantId:     item.variant_id,
        warehouseId:   input.from_warehouse_id,
        orgId:         ctx.orgId,
        movementType:  'transfer_out',
        referenceType: 'transfer',
        referenceId:   transferId,
        quantityDelta: qty.negated(),
        notes,
        actorId:       ctx.userId,
      }, t)

      await applyMovement({
        variantId:     item.variant_id,
        warehouseId:   input.to_warehouse_id,
        orgId:         ctx.orgId,
        movementType:  'transfer_in',
        referenceType: 'transfer',
        referenceId:   transferId,
        quantityDelta: qty,
        notes,
        actorId:       ctx.userId,
      }, t)

      moved++
    }
  })

  logger.info({
    transferId,
    from: input.from_warehouse_id,
    to: input.to_warehouse_id,
    moved,
    skipped,
    orgId: ctx.orgId,
  }, 'bulk stock transfer')

  return { transfer_id: transferId, moved_variants: moved, skipped_variants: skipped }
}

export interface TransferBatchResult {
  transfer_id: string
  moved_variants: number
  skipped_variants: number
}

async function transferOneVariant(
  params: {
    transferId: string
    variantId: string
    fromWarehouseId: string
    toWarehouseId: string
    quantity: Decimal
    notes: string | null
    orgId: string
    actorId: string
  },
  t: import('sequelize').Transaction,
): Promise<void> {
  const { transferId, variantId, fromWarehouseId, toWarehouseId, quantity, notes, orgId, actorId } = params
  await applyMovement({
    variantId,
    warehouseId:   fromWarehouseId,
    orgId,
    movementType:  'transfer_out',
    referenceType: 'transfer',
    referenceId:   transferId,
    quantityDelta: quantity.negated(),
    notes,
    actorId,
  }, t)

  await applyMovement({
    variantId,
    warehouseId:   toWarehouseId,
    orgId,
    movementType:  'transfer_in',
    referenceType: 'transfer',
    referenceId:   transferId,
    quantityDelta: quantity,
    notes,
    actorId,
  }, t)
}

/** Transfiere variantes seleccionadas (cantidad = saldo en origen si no se indica). */
export async function transferStockBatch(input: StockTransferBatchInput, ctx: TenantContext): Promise<TransferBatchResult> {
  await assertWarehouses(ctx, input.from_warehouse_id, input.to_warehouse_id)

  const transferId = randomUUID()
  const notes = input.notes?.trim() || null
  let moved = 0
  let skipped = 0

  await sequelize.transaction(async (t) => {
    for (const item of input.items) {
      try {
        await assertVariantTracksStock(item.variant_id, ctx.orgId)
      } catch {
        skipped++
        continue
      }

      let qty: Decimal
      const stockRow = await StockItem.findOne({
        where: {
          org_id:       ctx.orgId,
          warehouse_id: input.from_warehouse_id,
          variant_id:   item.variant_id,
        },
        attributes: ['quantity'],
        transaction: t,
        lock: true,
      })
      if (!stockRow) {
        skipped++
        continue
      }
      const available = new Decimal(stockRow.quantity)

      if (item.quantity != null) {
        qty = new Decimal(item.quantity)
        if (qty.gt(available)) throw new Error('INSUFFICIENT_STOCK')
      } else {
        qty = available
      }

      if (qty.lte(0)) {
        skipped++
        continue
      }

      await transferOneVariant({
        transferId,
        variantId:       item.variant_id,
        fromWarehouseId: input.from_warehouse_id,
        toWarehouseId:   input.to_warehouse_id,
        quantity:        qty,
        notes,
        orgId:           ctx.orgId,
        actorId:         ctx.userId,
      }, t)

      moved++
    }
  })

  if (moved === 0) throw new Error('TRANSFER_BATCH_EMPTY')

  logger.info({
    transferId,
    from: input.from_warehouse_id,
    to: input.to_warehouse_id,
    moved,
    skipped,
    orgId: ctx.orgId,
  }, 'batch stock transfer')

  return { transfer_id: transferId, moved_variants: moved, skipped_variants: skipped }
}
