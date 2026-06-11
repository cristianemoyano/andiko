import 'server-only'
import { Op } from 'sequelize'
import ProductCategory from './product-category.model'
import { generateSlug } from './product.utils'
import { paginate, toPaginated } from '@/lib/pagination'
import logger from '@/lib/logger'
import type { ProductCategoryInput, ProductCategoryUpdateInput, ProductCategoryQuery } from './product-category.schema'
import type { UUID } from '@/types'

function orgWhere(orgId: string | null) {
  return { org_id: orgId ?? null }
}

export async function listCategories(query: ProductCategoryQuery, orgId: string | null) {
  const { page, limit, search, parent_id, status } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = { ...orgWhere(orgId) }
  if (status)              where.status    = status
  if (parent_id !== undefined) where.parent_id = parent_id ?? null
  if (search) {
    where[Op.or as unknown as string] = [
      { name: { [Op.iLike]: `%${search}%` } },
    ]
  }

  const { rows, count } = await ProductCategory.findAndCountAll({
    where,
    limit,
    offset,
    order: [['name', 'ASC']],
    attributes: ['id', 'parent_id', 'name', 'slug', 'description', 'status', 'created_at'],
  })

  return toPaginated(rows, count, page, limit)
}

export async function getCategory(id: UUID, orgId: string | null) {
  const category = await ProductCategory.findOne({ where: { id, ...orgWhere(orgId) } })
  if (!category) throw new Error('CATEGORY_NOT_FOUND')
  return category
}

export async function createCategory(input: ProductCategoryInput, actorId: UUID, orgId: string | null) {
  const slug = generateSlug(input.name)
  const category = await ProductCategory.create({
    ...input,
    slug,
    org_id: orgId ?? null,
    created_by: actorId,
    updated_by: actorId,
  })
  logger.info({ categoryId: category.id, actorId }, 'product category created')
  return category
}

export async function updateCategory(id: UUID, input: ProductCategoryUpdateInput, actorId: UUID, orgId: string | null) {
  const category = await getCategory(id, orgId)
  const slug = input.name ? generateSlug(input.name) : undefined
  await category.update({ ...input, ...(slug ? { slug } : {}), updated_by: actorId })
  logger.info({ categoryId: id, actorId }, 'product category updated')
  return category
}

export async function deleteCategory(id: UUID, actorId: UUID, orgId: string | null) {
  const category = await getCategory(id, orgId)
  await category.update({ deleted_by: actorId })
  await category.destroy()
  logger.info({ categoryId: id, actorId }, 'product category deleted')
}
