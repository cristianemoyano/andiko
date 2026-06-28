import 'server-only'
import { Op } from 'sequelize'
import WoocommerceOrderLink from './woocommerce-order-link.model'
import WoocommerceSite from './woocommerce-site.model'
import { wooOrderStatusLabel } from './woo-order-status.utils'

export interface WooOrderChannelPayload {
  woo_order_id: string
  woo_status: string | null
  woo_status_label: string
  woo_order_created_at: string | null
  site_id: string | null
  site_name: string | null
  sync_status: string
  error_message: string | null
}

export type WooOrderChannelSummary = Pick<
  WooOrderChannelPayload,
  'woo_order_id' | 'woo_status' | 'woo_status_label' | 'woo_order_created_at'
>

export async function getWooOrderChannelSummariesForSalesOrders(
  salesOrderIds: string[],
  orgId: string,
): Promise<Map<string, WooOrderChannelSummary>> {
  if (salesOrderIds.length === 0) return new Map()

  const links = await WoocommerceOrderLink.findAll({
    where: { org_id: orgId, sales_order_id: { [Op.in]: salesOrderIds } },
    attributes: ['sales_order_id', 'woo_order_id', 'woo_status', 'woo_order_created_at'],
  })

  const map = new Map<string, WooOrderChannelSummary>()
  for (const link of links) {
    if (!link.sales_order_id) continue
    map.set(link.sales_order_id, {
      woo_order_id: link.woo_order_id,
      woo_status: link.woo_status,
      woo_status_label: wooOrderStatusLabel(link.woo_status),
      woo_order_created_at: link.woo_order_created_at?.toISOString() ?? null,
    })
  }
  return map
}

export async function getWooOrderChannelForSalesOrder(
  salesOrderId: string,
  orgId: string,
  channelSiteId: string | null,
): Promise<WooOrderChannelPayload | null> {
  const link = await WoocommerceOrderLink.findOne({
    where: { sales_order_id: salesOrderId, org_id: orgId },
    attributes: ['woo_order_id', 'woo_status', 'woo_order_created_at', 'sync_status', 'error_message'],
  })
  if (!link) return null

  let siteName: string | null = null
  if (channelSiteId) {
    const site = await WoocommerceSite.findByPk(channelSiteId, { attributes: ['name'] })
    siteName = site?.name ?? null
  }

  return {
    woo_order_id: link.woo_order_id,
    woo_status: link.woo_status,
    woo_status_label: wooOrderStatusLabel(link.woo_status),
    woo_order_created_at: link.woo_order_created_at?.toISOString() ?? null,
    site_id: channelSiteId,
    site_name: siteName,
    sync_status: link.sync_status,
    error_message: link.error_message,
  }
}
