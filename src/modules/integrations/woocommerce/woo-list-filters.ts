import { Op, literal } from 'sequelize'
import type { WhereOptions } from 'sequelize'
import { z } from 'zod'
import { WOO_IMPORT_SOURCE } from './woo-address.utils'
import { isWooOrderStatusSlug } from './woo-order-status.utils'

export { WOO_IMPORT_SOURCE }

/** Query param `?source=<source>` for list origin filters (woocommerce, erp, pos, catalog_csv, …). */
export const listSourceQuerySchema = z.string().max(32).optional()

/** Effective list origin: Woo when linked or imported from Woo; otherwise stored import_source. */
export function resolveListSource(
  importSource: string | null | undefined,
  wooLinked: boolean,
): string | null {
  if (wooLinked || importSource === WOO_IMPORT_SOURCE) return WOO_IMPORT_SOURCE
  return importSource ?? null
}

function woocommerceContactWhere(orgId: string): WhereOptions {
  return {
    [Op.or]: [
      { import_source: WOO_IMPORT_SOURCE },
      {
        id: {
          [Op.in]: literal(
            `(SELECT contact_id FROM woocommerce_customer_links WHERE org_id = '${orgId}')`,
          ),
        },
      },
    ],
  }
}

function woocommerceProductWhere(orgId: string): WhereOptions {
  return {
    [Op.or]: [
      { import_source: WOO_IMPORT_SOURCE },
      {
        id: {
          [Op.in]: literal(`(
            SELECT DISTINCT pv.product_id
            FROM woocommerce_product_links wpl
            INNER JOIN product_variants pv ON pv.id = wpl.variant_id AND pv.deleted_at IS NULL
            WHERE wpl.org_id = '${orgId}'
          )`),
        },
      },
    ],
  }
}

export function importSourceListWhere(
  source: string,
  orgId: string,
  kind: 'contact' | 'product',
): WhereOptions {
  if (source === WOO_IMPORT_SOURCE) {
    return kind === 'contact' ? woocommerceContactWhere(orgId) : woocommerceProductWhere(orgId)
  }
  return { import_source: source }
}

function hasWhereContent(part: WhereOptions): boolean {
  return Object.keys(part).length > 0 || Object.getOwnPropertySymbols(part).length > 0
}

/** Filters sales orders by raw WooCommerce status on the order link. */
export function wooOrderStatusListWhere(orgId: string, wooStatus: string): WhereOptions {
  if (!isWooOrderStatusSlug(wooStatus)) return {}
  return {
    id: {
      [Op.in]: literal(
        `(SELECT sales_order_id FROM woocommerce_order_links WHERE org_id = '${orgId}' AND woo_status = '${wooStatus}' AND sales_order_id IS NOT NULL)`,
      ),
    },
  }
}

export function combineListWhere(...parts: WhereOptions[]): WhereOptions {
  const active = parts.filter(hasWhereContent)
  if (active.length === 0) return {}
  if (active.length === 1) return active[0]!
  return { [Op.and]: active }
}
