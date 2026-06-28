import type { SalesOrderSource } from './sales-order.model'

export const SALES_ORDER_CHANNEL_LABEL: Record<SalesOrderSource, string> = {
  erp:          'Cloud',
  pos:          'POS',
  woocommerce:  'WooCommerce',
}

export const SALES_ORDER_CHANNEL_SHORT_LABEL: Record<SalesOrderSource, string> = {
  erp:          'Cloud',
  pos:          'POS',
  woocommerce:  'Woo',
}
