import 'server-only'
import { Op } from 'sequelize'
import Decimal from 'decimal.js'
import logger from '@/lib/logger'
import LowStockAlertQueue from './low-stock-alert-queue.model'
import StockItem from './stock-item.model'
import Warehouse from './warehouse.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import Product from '@/modules/catalog/product.model'
import OrganizationSetting from '@/modules/auth/organization-setting.model'
import User from '@/modules/auth/user.model'
import Organization from '@/modules/auth/organization.model'
import { getEffectiveEmailTemplates } from '@/modules/communications/email-templates.service'
import { emitNotification } from '@/modules/notifications/emit-notification.service'
import { lowStockAlertPayloadSchema } from '@/modules/notifications/notification.schema'
import { absoluteUrl } from '@/lib/absolute-url'

const MAX_QUEUE_ROWS = 200
const COOLDOWN_MS = 24 * 60 * 60 * 1000

async function sendAlertForQueueRow(row: LowStockAlertQueue): Promise<number> {
  const item = await StockItem.findOne({
    where: { id: row.stock_item_id },
    include: [
      { model: Warehouse, as: 'warehouse', attributes: ['id', 'name'] },
      {
        model: ProductVariant,
        as: 'variant',
        attributes: ['id', 'sku', 'name'],
        include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }],
      },
    ],
  })
  if (!item) return 0

  // Still below minimum? It may have been restocked since it was queued.
  if (!new Decimal(item.quantity).lt(item.minimum_quantity)) return 0

  if (item.last_low_stock_alert_at) {
    const elapsed = Date.now() - item.last_low_stock_alert_at.getTime()
    if (elapsed < COOLDOWN_MS) return 0
  }

  const orgSetting = await OrganizationSetting.findOne({
    where: { org_id: row.org_id },
    attributes: ['low_stock_alert_recipient_user_ids'],
  })
  const recipientIds = orgSetting?.low_stock_alert_recipient_user_ids ?? []
  if (recipientIds.length === 0) return 0

  const recipients = await User.findAll({
    where: { id: { [Op.in]: recipientIds }, org_id: row.org_id, is_active: true },
    attributes: ['id', 'email'],
  })
  if (recipients.length === 0) return 0

  const organization = await Organization.findByPk(row.org_id, { attributes: ['name'] })
  const variant = (item as unknown as { variant?: ProductVariant & { product?: Product } }).variant
  const warehouse = (item as unknown as { warehouse?: Warehouse }).warehouse

  const payload = lowStockAlertPayloadSchema.parse({
    stock_item_id: item.id,
    product_name: variant?.product?.name || 'Producto',
    variant_name: variant?.name || variant?.sku || 'Variante única',
    warehouse_name: warehouse?.name || 'Depósito',
    quantity: new Decimal(item.quantity).toFixed(2),
    minimum_quantity: new Decimal(item.minimum_quantity).toFixed(2),
    org_name: organization?.name ?? 'Andiko',
    document_url: absoluteUrl('/inventario/reposicion'),
  })

  let sent = 0
  for (const recipient of recipients) {
    try {
      await emitNotification(
        {
          eventKey: 'inventory.stock_low',
          recipient: { kind: 'email', address: recipient.email },
          payload,
          channels: ['email'],
        },
        { orgId: row.org_id, actorId: null },
      )
      sent += 1
    } catch (err) {
      logger.error({ err, recipientId: recipient.id, stockItemId: item.id }, 'low stock alert email failed')
    }
  }

  if (sent > 0) {
    await item.update({ last_low_stock_alert_at: new Date() })
  }

  return sent
}

/**
 * Drains the low-stock alert queue: for each pending row, resolves the org's
 * configured recipients and sends the alert email (unless the org disabled
 * the template), respecting a per-item cooldown. Always consumes the rows it
 * reads — including when the template is disabled — so the queue never grows
 * unbounded; disabling just means nothing gets sent, not that the queue jams.
 */
export async function drainPendingLowStockAlerts(orgId?: string): Promise<{ sent_count: number }> {
  const rows = await LowStockAlertQueue.findAll({
    where: orgId ? { org_id: orgId } : {},
    order: [['created_at', 'ASC']],
    limit: MAX_QUEUE_ROWS,
  })
  if (rows.length === 0) return { sent_count: 0 }

  let sentCount = 0
  const enabledByOrg = new Map<string, boolean>()

  for (const row of rows) {
    try {
      let enabled = enabledByOrg.get(row.org_id)
      if (enabled === undefined) {
        const templates = await getEffectiveEmailTemplates(row.org_id)
        enabled = templates.low_stock_alert.enabled
        enabledByOrg.set(row.org_id, enabled)
      }
      if (enabled) {
        sentCount += await sendAlertForQueueRow(row)
      }
    } catch (err) {
      logger.error({ err, stockItemId: row.stock_item_id, orgId: row.org_id }, 'low stock alert drain failed')
    } finally {
      await row.destroy()
    }
  }

  return { sent_count: sentCount }
}
