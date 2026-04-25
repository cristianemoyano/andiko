import 'server-only'
import type { Transaction } from 'sequelize'
import ProductVariant from './product-variant.model'
import { formatSku } from './product.utils'
import type { TenantContext } from '@/lib/tenancy'
import { whereOrg } from '@/lib/tenancy'

const MAX_SKU_ATTEMPTS = 5000

/** Garantiza un SKU único por organización; si no hay preferido, usa W + fallbackExternalId. */
export async function allocateUniqueVariantSku(
  ctx: TenantContext,
  preferred: string,
  fallbackExternalId: string,
  transaction: Transaction,
): Promise<string> {
  let base = preferred.trim() ? formatSku(preferred) : formatSku(`W${fallbackExternalId}`)
  if (base.length > 100) base = base.slice(0, 100)
  let candidate = base
  for (let n = 0; n < MAX_SKU_ATTEMPTS; n++) {
    const exists = await ProductVariant.findOne({
      where: { ...whereOrg(ctx), sku: candidate },
      transaction,
    })
    if (!exists) return candidate
    const suffix = `-X${n + 1}`
    candidate = formatSku((base.length + suffix.length > 100 ? base.slice(0, 100 - suffix.length) : base) + suffix)
  }
  throw new Error('SKU_ALLOCATION_EXHAUSTED')
}
