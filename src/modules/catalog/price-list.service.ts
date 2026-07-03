import 'server-only'
import { Op, type Transaction } from 'sequelize'
import sequelize from '@/lib/db'
import PriceList from './price-list.model'
import Product from './product.model'
import ProductVariant from './product-variant.model'
import PriceListItem from './price-list-item.model'
import { paginate, toPaginated } from '@/lib/pagination'
import { isMissingBasePrice } from './product.utils'
import logger from '@/lib/logger'
import type { PriceListInput, PriceListUpdateInput, PriceListQuery, PriceListItemInput, PriceListItemsQuery, ClonePriceListInput, FillPriceListFromCatalogInput, FillPriceListFromCatalogResult } from './price-list.schema'
import type { UUID } from '@/types'

function orgWhere(orgId: string) {
  return { org_id: orgId }
}

export async function listPriceLists(query: PriceListQuery, orgId: string) {
  const { page, limit, search, is_active } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = { ...orgWhere(orgId) }
  if (is_active !== undefined) where.is_active = is_active
  if (search) {
    where[Op.or as unknown as string] = [{ name: { [Op.iLike]: `%${search}%` } }]
  }

  const { rows, count } = await PriceList.findAndCountAll({
    where,
    limit,
    offset,
    order: [['is_default', 'DESC'], ['name', 'ASC']],
    attributes: ['id', 'name', 'description', 'is_default', 'is_active', 'created_at'],
  })

  return toPaginated(rows, count, page, limit)
}

export async function getPriceList(id: UUID, orgId: string) {
  const priceList = await PriceList.findOne({ where: { id, ...orgWhere(orgId) } })
  if (!priceList) throw new Error('PRICE_LIST_NOT_FOUND')
  return priceList
}

export async function createPriceList(input: PriceListInput, actorId: UUID, orgId: string) {
  const priceList = await sequelize.transaction(async (t) => {
    if (input.is_default) {
      await PriceList.update(
        { is_default: false, updated_by: actorId },
        { where: { ...orgWhere(orgId) }, transaction: t }
      )
    }

    return PriceList.create(
      {
        ...input,
        org_id: orgId,
        created_by: actorId,
        updated_by: actorId,
      },
      { transaction: t }
    )
  })
  logger.info({ priceListId: priceList.id, actorId }, 'price list created')
  return priceList
}

export async function updatePriceList(id: UUID, input: PriceListUpdateInput, actorId: UUID, orgId: string) {
  const priceList = await getPriceList(id, orgId)

  await sequelize.transaction(async (t) => {
    if (input.is_default) {
      await PriceList.update(
        { is_default: false, updated_by: actorId },
        { where: { ...orgWhere(orgId) }, transaction: t }
      )
    }
    await priceList.update({ ...input, updated_by: actorId }, { transaction: t })
  })
  logger.info({ priceListId: id, actorId }, 'price list updated')
  return priceList
}

export async function deletePriceList(id: UUID, actorId: UUID, orgId: string) {
  const priceList = await getPriceList(id, orgId)
  if (priceList.is_default) throw new Error('CANNOT_DELETE_DEFAULT_PRICE_LIST')
  await priceList.update({ deleted_by: actorId })
  await priceList.destroy()
  logger.info({ priceListId: id, actorId }, 'price list deleted')
}

const CLONE_ITEMS_BATCH_SIZE = 500
const FILL_ITEMS_BATCH_SIZE = 500

async function resolveFillPriceListCandidates(
  priceListId: UUID,
  orgId: string,
  categoryId?: UUID,
  includeWithoutPrice = false,
): Promise<{
  toAdd: Array<{ variantId: UUID; price: string; normalizeBasePrice: boolean }>
  skipped_existing: number
  skipped_no_price: number
  total_active_variants: number
}> {
  const productWhere: Record<string, unknown> = { ...orgWhere(orgId), status: 'active' }
  if (categoryId) productWhere.category_id = categoryId

  const variants = await ProductVariant.findAll({
    attributes: ['id', 'base_price'],
    where: orgWhere(orgId),
    include: [{
      model: Product,
      as: 'product',
      required: true,
      attributes: ['id'],
      where: productWhere,
    }],
  })

  const existingItems = await PriceListItem.findAll({
    where: { price_list_id: priceListId, ...orgWhere(orgId) },
    attributes: ['product_variant_id'],
  })
  const existingIds = new Set(existingItems.map((item) => item.product_variant_id))
  const skipped_existing = variants.filter((v) => existingIds.has(v.id)).length

  const candidates = variants.filter((v) => !existingIds.has(v.id))
  const withoutPrice = candidates.filter((v) => isMissingBasePrice(v.base_price))
  const withPrice = candidates.filter((v) => !isMissingBasePrice(v.base_price))

  const toAdd = [
    ...withPrice.map((v) => ({
      variantId: v.id,
      price: String(v.base_price),
      normalizeBasePrice: false,
    })),
    ...(includeWithoutPrice
      ? withoutPrice.map((v) => ({
          variantId: v.id,
          price: '0.00',
          normalizeBasePrice: true,
        }))
      : []),
  ]
  const skipped_no_price = includeWithoutPrice ? 0 : withoutPrice.length

  return { toAdd, skipped_existing, skipped_no_price, total_active_variants: variants.length }
}

export async function fillPriceListFromCatalog(
  priceListId: UUID,
  input: FillPriceListFromCatalogInput,
  actorId: UUID,
  orgId: string,
): Promise<FillPriceListFromCatalogResult> {
  await getPriceList(priceListId, orgId)

  const { toAdd, skipped_existing, skipped_no_price, total_active_variants } = await resolveFillPriceListCandidates(
    priceListId,
    orgId,
    input.category_id,
    input.include_without_price,
  )

  if (input.dry_run || toAdd.length === 0) {
    return { added: toAdd.length, skipped_existing, skipped_no_price, total_active_variants }
  }

  await sequelize.transaction(async (t) => {
    for (let i = 0; i < toAdd.length; i += FILL_ITEMS_BATCH_SIZE) {
      const batch = toAdd.slice(i, i + FILL_ITEMS_BATCH_SIZE)
      await PriceListItem.bulkCreate(
        batch.map((row) => ({
          price_list_id: priceListId,
          product_variant_id: row.variantId,
          org_id: orgId,
          price: row.price,
          created_by: actorId,
          updated_by: actorId,
        })),
        { transaction: t },
      )
    }

    const normalizeIds = toAdd.filter((row) => row.normalizeBasePrice).map((row) => row.variantId)
    for (let i = 0; i < normalizeIds.length; i += FILL_ITEMS_BATCH_SIZE) {
      const batch = normalizeIds.slice(i, i + FILL_ITEMS_BATCH_SIZE)
      await ProductVariant.update(
        { base_price: '0.00', updated_by: actorId },
        {
          where: {
            id: { [Op.in]: batch },
            ...orgWhere(orgId),
            base_price: null,
          },
          transaction: t,
        },
      )
    }
  })

  logger.info(
    { priceListId, added: toAdd.length, skipped_existing, skipped_no_price, categoryId: input.category_id, actorId },
    'price list filled from catalog',
  )

  return { added: toAdd.length, skipped_existing, skipped_no_price, total_active_variants }
}

export async function clonePriceList(
  sourceId: UUID,
  input: ClonePriceListInput,
  actorId: UUID,
  orgId: string,
) {
  await getPriceList(sourceId, orgId)

  return sequelize.transaction(async (t) => {
    const sourceItems = await PriceListItem.findAll({
      where: { price_list_id: sourceId, ...orgWhere(orgId) },
      attributes: ['product_variant_id', 'price'],
      transaction: t,
    })

    const newList = await PriceList.create(
      {
        name: input.name,
        description: input.description ?? null,
        is_default: false,
        is_active: input.is_active ?? true,
        org_id: orgId,
        created_by: actorId,
        updated_by: actorId,
      },
      { transaction: t },
    )

    for (let i = 0; i < sourceItems.length; i += CLONE_ITEMS_BATCH_SIZE) {
      const batch = sourceItems.slice(i, i + CLONE_ITEMS_BATCH_SIZE)
      await PriceListItem.bulkCreate(
        batch.map((item) => ({
          price_list_id: newList.id,
          product_variant_id: item.product_variant_id,
          org_id: orgId,
          price: item.price,
          created_by: actorId,
          updated_by: actorId,
        })),
        { transaction: t },
      )
    }

    logger.info(
      { sourceId, priceListId: newList.id, itemsCopied: sourceItems.length, actorId },
      'price list cloned',
    )

    return { priceList: newList, items_copied: sourceItems.length }
  })
}

export async function listPriceListItems(priceListId: UUID, query: PriceListItemsQuery, orgId: string) {
  await getPriceList(priceListId, orgId)

  const { page, limit, search } = query
  const { offset } = paginate(page, limit)

  const baseWhere = { price_list_id: priceListId, ...orgWhere(orgId) }
  const where: Record<string, unknown> = search?.trim()
    ? {
        [Op.and]: [
          baseWhere,
          {
            [Op.or]: [
              { '$variant.sku$': { [Op.iLike]: `%${search.trim()}%` } },
              { '$variant.name$': { [Op.iLike]: `%${search.trim()}%` } },
              { '$variant.product.name$': { [Op.iLike]: `%${search.trim()}%` } },
            ],
          },
        ],
      }
    : baseWhere

  const { rows, count } = await PriceListItem.findAndCountAll({
    where,
    attributes: ['id', 'price', 'valid_from', 'created_at', 'updated_at'],
    include: [{
      model: ProductVariant,
      as: 'variant',
      required: true,
      attributes: ['id', 'sku', 'name', 'base_price', 'product_id'],
      include: [{
        model: Product,
        as: 'product',
        required: true,
        attributes: ['id', 'name'],
      }],
    }],
    order: [
      ['valid_from', 'DESC'],
      [{ model: ProductVariant, as: 'variant' }, 'sku', 'ASC'],
    ],
    limit,
    offset,
    distinct: true,
    subQuery: false,
  })

  return toPaginated(rows, count, page, limit)
}

export async function upsertPriceListItemInTransaction(
  priceListId: UUID,
  variantId: UUID,
  price: string,
  actorId: UUID,
  orgId: string,
  transaction: Transaction,
) {
  // Soft-delete current price — keeps history
  await PriceListItem.update(
    { deleted_by: actorId },
    {
      where: { price_list_id: priceListId, product_variant_id: variantId, ...orgWhere(orgId) },
      transaction,
    },
  )
  await PriceListItem.destroy({
    where: { price_list_id: priceListId, product_variant_id: variantId, ...orgWhere(orgId) },
    transaction,
  })

  return PriceListItem.create(
    {
      price_list_id: priceListId,
      product_variant_id: variantId,
      org_id: orgId,
      price,
      created_by: actorId,
      updated_by: actorId,
    },
    { transaction },
  )
}

export async function setPriceListItem(priceListId: UUID, input: PriceListItemInput, actorId: UUID, orgId: string) {
  await getPriceList(priceListId, orgId)

  return sequelize.transaction(async (t) => {
    const item = await upsertPriceListItemInTransaction(
      priceListId,
      input.product_variant_id,
      input.price,
      actorId,
      orgId,
      t,
    )

    logger.info({ priceListId, variantId: input.product_variant_id, price: input.price, actorId }, 'price set')
    return item
  })
}

export async function removePriceListItem(itemId: UUID, actorId: UUID, orgId: string) {
  const item = await PriceListItem.findOne({ where: { id: itemId, ...orgWhere(orgId) } })
  if (!item) throw new Error('PRICE_LIST_ITEM_NOT_FOUND')
  await item.update({ deleted_by: actorId })
  await item.destroy()
  logger.info({ itemId, actorId }, 'price list item removed')
}

export async function getEffectivePrice(priceListId: UUID, variantId: UUID, orgId: string): Promise<string | null> {
  const item = await PriceListItem.findOne({
    where: { price_list_id: priceListId, product_variant_id: variantId, ...orgWhere(orgId) },
  })
  if (item) return item.price

  const variant = await ProductVariant.findByPk(variantId, { attributes: ['base_price'] })
  return variant?.base_price ?? null
}

/** Precio efectivo por variante: ítem de lista si existe, si no `base_price`. */
export async function getEffectivePricesForVariants(
  priceListId: string | null | undefined,
  variantIds: string[],
  orgId: string,
): Promise<Record<string, string>> {
  const uniqueIds = [...new Set(variantIds.filter(Boolean))]
  if (uniqueIds.length === 0) return {}

  const variants = await ProductVariant.findAll({
    where: { id: { [Op.in]: uniqueIds }, org_id: orgId },
    attributes: ['id', 'base_price'],
  })

  const prices: Record<string, string> = {}
  for (const variant of variants) {
    prices[variant.id] = (variant.base_price as string | null) ?? '0.00'
  }

  if (!priceListId) return prices

  const listItems = await PriceListItem.findAll({
    where: {
      price_list_id: priceListId,
      product_variant_id: { [Op.in]: uniqueIds },
      ...orgWhere(orgId),
    },
    attributes: ['product_variant_id', 'price'],
  })

  for (const item of listItems) {
    prices[item.product_variant_id] = item.price
  }

  return prices
}
