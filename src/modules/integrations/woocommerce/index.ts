// Public surface of the WooCommerce provider. Prefer importing from here (or from
// `@/modules/integrations` for the provider-agnostic API) over deep file paths.

export { wooCommerceAdapter } from './woocommerce.adapter'

export { default as WoocommerceSite } from './woocommerce-site.model'
export { default as WoocommerceProductLink } from './woocommerce-product-link.model'
export { default as WoocommerceOrderLink } from './woocommerce-order-link.model'
export { default as WoocommerceCustomerLink } from './woocommerce-customer-link.model'
export { default as WoocommerceSyncQueue } from './woocommerce-sync-queue.model'

export * from './woocommerce.schema'
export {
  listSites,
  getSite,
  createSite,
  updateSite,
  deleteSite,
  orgHasWoocommerceSites,
  toPublicSite,
} from './woo-sites.service'
