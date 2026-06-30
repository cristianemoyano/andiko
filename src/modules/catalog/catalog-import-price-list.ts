import 'server-only'
import type { Transaction } from 'sequelize'
import PriceList from './price-list.model'
import { upsertPriceListItemInTransaction } from './price-list.service'
import { importBasePrice } from './product.utils'
import logger from '@/lib/logger'

/** Evita repetir la consulta de lista default dentro del mismo transaction de import. */
const defaultListIdByTransaction = new WeakMap<Transaction, string | null>()

async function resolveDefaultPriceListId(
  orgId: string,
  transaction: Transaction,
): Promise<string | null> {
  if (defaultListIdByTransaction.has(transaction)) {
    return defaultListIdByTransaction.get(transaction) ?? null
  }

  const list = await PriceList.findOne({
    where: { org_id: orgId, is_default: true, is_active: true },
    attributes: ['id'],
    transaction,
  })
  const id = list?.id ?? null
  defaultListIdByTransaction.set(transaction, id)
  return id
}

/**
 * Replica el precio en la lista default de la org (vacío → $0).
 * Sin esto, ventas con lista asignada no ven el precio de la variante.
 */
export async function syncImportedPriceToDefaultList(
  orgId: string,
  variantId: string,
  price: string | null | undefined,
  actorId: string,
  transaction: Transaction,
): Promise<void> {
  const effective = importBasePrice(price)

  const priceListId = await resolveDefaultPriceListId(orgId, transaction)
  if (!priceListId) {
    logger.warn({ orgId, variantId }, 'import price not synced: no default price list')
    return
  }

  await upsertPriceListItemInTransaction(
    priceListId,
    variantId,
    effective,
    actorId,
    orgId,
    transaction,
  )
}
