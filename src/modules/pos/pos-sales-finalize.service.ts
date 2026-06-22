import 'server-only'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import Invoice from '@/modules/sales/invoice.model'
import InvoiceItem from '@/modules/sales/invoice-item.model'
import Payment from '@/modules/sales/payment.model'
import SalesOrder from '@/modules/sales/sales-order.model'
import SalesOrderItem from '@/modules/sales/sales-order-item.model'
import StockMovement from '@/modules/inventory/stock-movement.model'
import { deductStockForOrder } from '@/modules/inventory/stock-movements.service'
import { nextDocumentNumber } from '@/modules/sales/sales.utils'
import { recalcInvoiceBalance } from '@/modules/sales/invoices.service'
import type { PaymentMethod } from '@/modules/sales/payment.model'
import type { PosSaleAuthorizeInput } from '@/modules/pos/pos-fiscal.schema'

function mapPosPaymentMethod(type: string): PaymentMethod {
  const normalized = type.toLowerCase()
  if (normalized === 'cash' || normalized === 'efectivo') return 'cash'
  if (normalized === 'card' || normalized.includes('tarjeta')) return 'card'
  if (normalized === 'transfer' || normalized.includes('transferencia')) return 'transfer'
  if (normalized === 'check' || normalized.includes('cheque')) return 'check'
  // qr, current_account, etc. — accounting bucket; display name comes from payment_method_name
  return 'other'
}

function resolveActorId(order: SalesOrder): string | null {
  return order.salesperson_id ?? order.created_by ?? order.updated_by
}

async function ensureOrderStockDeducted(
  orderId: string,
  orgId: string,
  actorId: string | null,
  t: import('sequelize').Transaction,
): Promise<void> {
  const existing = await StockMovement.findOne({
    where: {
      org_id: orgId,
      reference_type: 'order',
      reference_id: orderId,
      movement_type: 'out',
    },
    attributes: ['id'],
    transaction: t,
  })
  if (existing) return
  await deductStockForOrder(orderId, orgId, actorId ?? orgId, t)
}

function afipFieldsFromOrder(order: SalesOrder) {
  const caeExpiration = order.cae_expiration
    ? new Date(String(order.cae_expiration))
    : null
  return {
    cae: order.cae,
    cae_expiration: caeExpiration,
    comprobante_tipo: order.comprobante_tipo,
    punto_venta: order.punto_venta,
    cbte_numero: order.cbte_numero,
    afip_status: order.afip_status,
    afip_observations: order.afip_observations,
  }
}

async function syncInvoiceAfipFromOrder(
  invoice: Invoice,
  order: SalesOrder,
  actorId: string | null,
  t: import('sequelize').Transaction,
): Promise<Invoice> {
  const patch: Record<string, unknown> = { updated_by: actorId }
  if (order.cae && !invoice.cae) {
    Object.assign(patch, afipFieldsFromOrder(order))
    patch.issue_date = order.issue_date ? new Date(String(order.issue_date)) : invoice.issue_date
  }
  if (actorId && invoice.salesperson_id !== actorId) {
    patch.salesperson_id = actorId
  }
  if (Object.keys(patch).length > 1) {
    await invoice.update(patch, { transaction: t })
    await invoice.reload({ transaction: t })
  }
  return invoice
}

async function registerPosPaymentsOnInvoice(
  invoice: Invoice,
  order: SalesOrder,
  payments: PosSaleAuthorizeInput['payments'],
  actorId: string | null,
  issueDate: Date,
  t: import('sequelize').Transaction,
): Promise<void> {
  if (payments.length === 0 || !order.branch_id) return

  const existingCount = await Payment.count({ where: { invoice_id: invoice.id }, transaction: t })
  if (existingCount > 0) return

  for (const payment of payments) {
    const paymentNumber = await nextDocumentNumber(order.org_id!, order.branch_id, 'payment', t)
    await Payment.create(
      {
        org_id: order.org_id,
        branch_id: order.branch_id,
        invoice_id: invoice.id,
        contact_id: order.contact_id,
        salesperson_id: actorId,
        payment_number: paymentNumber,
        payment_date: issueDate,
        amount: payment.amount,
        payment_method: mapPosPaymentMethod(payment.payment_method_type),
        reference: payment.reference ?? null,
        notes: payment.payment_method_name,
        created_by: actorId,
        updated_by: actorId,
      },
      { transaction: t },
    )
  }

  await recalcInvoiceBalance(invoice.id, t)
}

/**
 * Marks a POS sales order as delivered and creates the linked invoice (with AFIP + cash payments).
 * Idempotent: safe to call after register, authorize, or legacy sync.
 */
export async function finalizePosSaleInErp(
  orderId: string,
  orgId: string,
  options: {
    payments?: PosSaleAuthorizeInput['payments']
    requireAfip?: boolean
  } = {},
): Promise<Invoice | null> {
  const requireAfip = options.requireAfip ?? true

  return sequelize.transaction(async (t) => {
    const order = await SalesOrder.findOne({
      where: { id: orderId, org_id: orgId, source: 'pos' },
      transaction: t,
      lock: t.LOCK.UPDATE,
    })
    if (!order) return null

    if (requireAfip && !order.cae) {
      return null
    }

    const items = await SalesOrderItem.findAll({
      where: { order_id: order.id },
      order: [['sort_order', 'ASC']],
      transaction: t,
    })

    const actorId = resolveActorId(order)

    const existingInvoice = await Invoice.findOne({
      where: { order_id: order.id, org_id: orgId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    })
    if (existingInvoice) {
      const synced = await syncInvoiceAfipFromOrder(existingInvoice, order, actorId, t)
      const issueDate = order.issue_date ? new Date(String(order.issue_date)) : order.created_at
      await registerPosPaymentsOnInvoice(synced, order, options.payments ?? [], actorId, issueDate, t)
      return synced.reload({ transaction: t })
    }

    if (!order.branch_id) throw new Error('ORDER_BRANCH_REQUIRED')

    await ensureOrderStockDeducted(order.id, orgId, actorId, t)

    const deliveredDate = order.issue_date
      ? new Date(String(order.issue_date))
      : order.created_at

    if (order.status !== 'delivered') {
      await order.update(
        {
          status: 'delivered',
          delivered_date: deliveredDate,
          updated_by: actorId,
        },
        { transaction: t },
      )
    }

    const invoiceNumber = await nextDocumentNumber(orgId, order.branch_id, 'invoice', t)
    const issueDate = order.issue_date ? new Date(String(order.issue_date)) : deliveredDate

    const invoice = await Invoice.create(
      {
        org_id: orgId,
        branch_id: order.branch_id,
        contact_id: order.contact_id,
        order_id: order.id,
        price_list_id: order.price_list_id,
        invoice_number: invoiceNumber,
        salesperson_id: actorId,
        status: 'issued',
        issue_date: issueDate,
        due_date: issueDate,
        payment_condition: order.payment_condition,
        currency: order.currency,
        subtotal: order.subtotal,
        discount_amount: order.discount_amount,
        tax_amount: order.tax_amount,
        total: order.total,
        paid_amount: '0.00',
        balance: order.total,
        notes: order.notes,
        ...afipFieldsFromOrder(order),
        created_by: actorId,
        updated_by: actorId,
      },
      { transaction: t },
    )

    await InvoiceItem.bulkCreate(
      items.map((item) => ({
        invoice_id: invoice.id,
        org_id: orgId,
        product_id: item.product_id,
        variant_id: item.variant_id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_pct: item.discount_pct,
        iva_rate: item.iva_rate,
        subtotal: item.subtotal,
        discount_amount: item.discount_amount,
        tax_base: item.tax_base,
        tax_amount: item.tax_amount,
        total: item.total,
        sort_order: item.sort_order,
        created_by: actorId,
        updated_by: actorId,
      })),
      { transaction: t },
    )

    const payments = options.payments ?? []
    await registerPosPaymentsOnInvoice(invoice, order, payments, actorId, issueDate, t)

    await invoice.reload({ transaction: t })
    logger.info(
      { orderId: order.id, invoiceId: invoice.id, orgId, afipStatus: order.afip_status },
      'pos sale finalized in erp',
    )
    return invoice
  })
}
