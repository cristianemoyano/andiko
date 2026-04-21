import 'server-only'
import { Op } from 'sequelize'
import sequelize from '@/lib/db'
import PriceList from './price-list.model'
import PriceListItem from './price-list-item.model'
import ProductVariant from './product-variant.model'
import { paginate, toPaginated } from '@/lib/pagination'
import logger from '@/lib/logger'
import type { PriceListInput, PriceListUpdateInput, PriceListQuery, PriceListItemInput } from './price-list.schema'
import type { UUID } from '@/types'

function orgWhere(orgId: string | null) {
  return { org_id: orgId ?? null }
}

export async function listPriceLists(query: PriceListQuery, orgId: string | null) {
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

export async function getPriceList(id: UUID, orgId: string | null) {
  const priceList = await PriceList.findOne({ where: { id, ...orgWhere(orgId) } })
  if (!priceList) throw new Error('PRICE_LIST_NOT_FOUND')
  return priceList
}

export async function createPriceList(input: PriceListInput, actorId: UUID, orgId: string | null) {
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
        org_id: orgId ?? null,
        created_by: actorId,
        updated_by: actorId,
      },
      { transaction: t }
    )
  })
  logger.info({ priceListId: priceList.id, actorId }, 'price list created')
  return priceList
}

export async function updatePriceList(id: UUID, input: PriceListUpdateInput, actorId: UUID, orgId: string | null) {
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

export async function deletePriceList(id: UUID, actorId: UUID, orgId: string | null) {
  const priceList = await getPriceList(id, orgId)
  if (priceList.is_default) throw new Error('CANNOT_DELETE_DEFAULT_PRICE_LIST')
  await priceList.update({ deleted_by: actorId })
  await priceList.destroy()
  logger.info({ priceListId: id, actorId }, 'price list deleted')
}

export async function listPriceListItems(priceListId: UUID, orgId: string | null) {
  await getPriceList(priceListId, orgId)
  return PriceListItem.findAll({
    where: { price_list_id: priceListId, ...orgWhere(orgId) },
    include: [{ model: ProductVariant, as: 'variant', attributes: ['id', 'sku', 'name', 'base_price', 'product_id'] }],
    order: [['valid_from', 'DESC']],
  })
}

export async function setPriceListItem(priceListId: UUID, input: PriceListItemInput, actorId: UUID, orgId: string | null) {
  await getPriceList(priceListId, orgId)

  return sequelize.transaction(async (t) => {
    // Soft-delete current price — keeps history
    await PriceListItem.update(
      { deleted_by: actorId },
      { where: { price_list_id: priceListId, product_variant_id: input.product_variant_id, ...orgWhere(orgId) }, transaction: t }
    )
    await PriceListItem.destroy({
      where: { price_list_id: priceListId, product_variant_id: input.product_variant_id, ...orgWhere(orgId) },
      transaction: t,
    })

    const item = await PriceListItem.create(
      {
        price_list_id:      priceListId,
        product_variant_id: input.product_variant_id,
        org_id:             orgId ?? null,
        price:              input.price,
        created_by:         actorId,
        updated_by:         actorId,
      },
      { transaction: t }
    )

    logger.info({ priceListId, variantId: input.product_variant_id, price: input.price, actorId }, 'price set')
    return item
  })
}

export async function removePriceListItem(itemId: UUID, actorId: UUID, orgId: string | null) {
  const item = await PriceListItem.findOne({ where: { id: itemId, ...orgWhere(orgId) } })
  if (!item) throw new Error('PRICE_LIST_ITEM_NOT_FOUND')
  await item.update({ deleted_by: actorId })
  await item.destroy()
  logger.info({ itemId, actorId }, 'price list item removed')
}

export async function getEffectivePrice(priceListId: UUID, variantId: UUID, orgId: string | null): Promise<string | null> {
  const item = await PriceListItem.findOne({
    where: { price_list_id: priceListId, product_variant_id: variantId, ...orgWhere(orgId) },
  })
  if (item) return item.price

  const variant = await ProductVariant.findByPk(variantId, { attributes: ['base_price'] })
  return variant?.base_price ?? null
}
