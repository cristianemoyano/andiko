import 'server-only'
import type { Transaction } from 'sequelize'
import logger from '@/lib/logger'
import Contact from '@/modules/contacts/contact.model'
import Product from '@/modules/catalog/product.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import SalesOrder from '@/modules/sales/sales-order.model'
import WoocommerceCustomerLink from './woocommerce-customer-link.model'
import WoocommerceOrderLink from './woocommerce-order-link.model'
import type WoocommerceSite from './woocommerce-site.model'

/** Woo order IDs whose link points to a live (non-deleted) sales order. */
export { activeImportedWooOrderIds } from './woo-sync-links.utils'
export async function resolveLiveContactForCustomerLink(
  site: WoocommerceSite,
  link: WoocommerceCustomerLink,
  t?: Transaction,
): Promise<Contact | null> {
  const contact = await Contact.findOne({
    where: { id: link.contact_id, org_id: site.org_id },
    transaction: t,
    paranoid: false,
  })

  if (contact && !contact.deleted_at) return contact

  await link.destroy({ transaction: t })
  logger.info(
    { siteId: site.id, wooCustomerId: link.woo_customer_id, contactId: link.contact_id },
    'woocommerce customer link cleared (contact missing or deleted)',
  )
  return null
}

/**
 * Returns a live sales order for the link, or clears a stale sales_order_id so the
 * Woo order can be ingested again after the ERP order was soft-deleted.
 */
export async function resolveLiveSalesOrderForOrderLink(
  orgId: string,
  link: WoocommerceOrderLink,
  t?: Transaction,
): Promise<SalesOrder | null> {
  if (!link.sales_order_id) return null

  const salesOrder = await SalesOrder.findOne({
    where: { id: link.sales_order_id, org_id: orgId },
    transaction: t,
    paranoid: false,
  })

  if (salesOrder && !salesOrder.deleted_at) return salesOrder

  const staleSalesOrderId = link.sales_order_id
  await link.update(
    {
      sales_order_id: null,
      sync_status: 'pending',
      error_message: null,
      processed_at: null,
    },
    { transaction: t },
  )
  logger.info(
    { siteId: link.site_id, wooOrderId: link.woo_order_id, salesOrderId: staleSalesOrderId },
    'woocommerce order link cleared (sales order missing or deleted)',
  )
  return null
}

/** Finds an active variant by SKU, or restores a soft-deleted variant (and parent product). */
export async function findOrRestoreVariantBySku(
  orgId: string,
  sku: string,
  t?: Transaction,
): Promise<ProductVariant | null> {
  const live = await ProductVariant.findOne({
    where: { sku, org_id: orgId },
    transaction: t,
  })
  if (live) return live

  const deleted = await ProductVariant.findOne({
    where: { sku, org_id: orgId },
    transaction: t,
    paranoid: false,
  })
  if (!deleted?.deleted_at) return null

  const product = await Product.findByPk(deleted.product_id, { transaction: t, paranoid: false })
  if (product?.deleted_at) {
    await product.restore({ transaction: t })
  }
  await deleted.restore({ transaction: t })
  logger.info({ orgId, sku, variantId: deleted.id }, 'restored soft-deleted catalog row for woo re-import')
  return deleted
}
