import 'server-only'
import type { Transaction } from 'sequelize'
import ProductCategory from './product-category.model'
import { generateSlug } from './product.utils'
import type { TenantContext } from '@/lib/tenancy'
import type { UUID } from '@/types'

export async function resolveOrCreateCategoryIdForImport(
  nameRaw: string,
  categoryByName: Map<string, string>,
  ctx: TenantContext,
  actorId: UUID,
  transaction: Transaction,
): Promise<string | undefined> {
  const segment = nameRaw.split(',')[0]?.trim().slice(0, 100) ?? ''
  if (!segment) return undefined
  const key = segment.toLowerCase()
  const existing = categoryByName.get(key)
  if (existing) return existing
  const slug = generateSlug(segment).slice(0, 110)
  const cat = await ProductCategory.create(
    {
      name: segment,
      slug,
      org_id: ctx.orgId,
      status: 'active',
      created_by: actorId,
      updated_by: actorId,
    },
    { transaction },
  )
  categoryByName.set(key, cat.id)
  return cat.id
}
