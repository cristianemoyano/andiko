import 'server-only'
import Decimal from 'decimal.js'
import sequelize from '@/lib/db'
import User from '@/modules/auth/user.model'
import SalesOrder from '@/modules/sales/sales-order.model'
import SalesOrderItem from '@/modules/sales/sales-order-item.model'
import { nextDocumentNumber } from '@/modules/sales/sales.utils'
import type { IvaRate } from '@/modules/catalog/product.model'
import type { PosDeviceContext } from '@/lib/pos-auth'
import type { PosSaleAuthorizeInput } from './pos-fiscal.schema'
import { deductStockForOrder } from '@/modules/inventory/stock-movements.service'

function calcItem(qty: number, unitPrice: string, ivaRate: IvaRate) {
  const unitGross = new Decimal(unitPrice)
  const quantity = new Decimal(qty)
  const gross = unitGross.mul(quantity).toDecimalPlaces(2)
  const rate = new Decimal(ivaRate).div(100)
  const divisor = new Decimal(1).add(rate)
  const taxBase = gross.div(divisor).toDecimalPlaces(2)
  const taxAmount = gross.sub(taxBase).toDecimalPlaces(2)
  return {
    subtotal: taxBase.toFixed(2),
    taxBase: taxBase.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    total: gross.toFixed(2),
  }
}

async function resolveVerifiedCashier(orgId: string, cashierUserId?: string | null): Promise<string | null> {
  if (!cashierUserId) return null
  const cashier = await User.findOne({
    where: { id: cashierUserId, org_id: orgId },
    attributes: ['id'],
  })
  return cashier?.id ?? null
}

/** Creates or returns an existing POS sales order (idempotent by pos_sale_id). */
export async function upsertPosSalesOrder(
  ctx: PosDeviceContext,
  sale: PosSaleAuthorizeInput,
): Promise<SalesOrder> {
  if (!ctx.branchId) throw new Error('POS_BRANCH_REQUIRED')

  const existing = await SalesOrder.findOne({
    where: {
      org_id: ctx.orgId,
      pos_device_id: ctx.deviceId,
      pos_sale_id: sale.pos_sale_id,
      source: 'pos',
    },
  })
  const verifiedCashierId = await resolveVerifiedCashier(ctx.orgId, sale.cashier_user_id)
  if (existing) {
    if (verifiedCashierId && existing.salesperson_id !== verifiedCashierId) {
      await existing.update({ salesperson_id: verifiedCashierId })
    }
    return existing
  }

  const soldAt = new Date(sale.sold_at)
  const issueDate = soldAt.toISOString().slice(0, 10)

  return sequelize.transaction(async (t) => {
    const orderNumber = await nextDocumentNumber(ctx.orgId, ctx.branchId!, 'order', t)

    let docSubtotal = new Decimal(0)
    let docTaxAmount = new Decimal(0)
    let docTotal = new Decimal(0)

    const itemRows = sale.items.map((item, idx) => {
      const { subtotal, taxBase, taxAmount, total } = calcItem(item.qty, item.unit_price, item.iva_rate as IvaRate)
      docSubtotal = docSubtotal.add(subtotal)
      docTaxAmount = docTaxAmount.add(taxAmount)
      docTotal = docTotal.add(total)
      return {
        variant_id: item.variant_id ?? null,
        product_id: null,
        description: item.description,
        quantity: String(item.qty),
        unit_price: item.unit_price,
        discount_pct: '0.00',
        iva_rate: item.iva_rate as IvaRate,
        subtotal,
        discount_amount: '0.00',
        tax_base: taxBase,
        tax_amount: taxAmount,
        total,
        sort_order: idx,
      }
    })

    const order = await SalesOrder.create(
      {
        org_id: ctx.orgId,
        branch_id: ctx.branchId,
        contact_id: sale.customer_id ?? null,
        source: 'pos',
        pos_device_id: ctx.deviceId,
        pos_sale_id: sale.pos_sale_id,
        salesperson_id: verifiedCashierId,
        order_number: orderNumber,
        status: 'confirmed',
        payment_condition: 'cash',
        currency: 'ARS',
        issue_date: issueDate,
        notes: `POS ${ctx.deviceId}${sale.cashier_name ? ` / ${sale.cashier_name}` : ''}${sale.cashier_user_id ? ` (#${sale.cashier_user_id})` : ''} · ${sale.payments.map((p) => p.payment_method_name).join('+')} · ${sale.pos_sale_id}`,
        subtotal: docSubtotal.toFixed(2),
        discount_amount: '0.00',
        tax_amount: docTaxAmount.toFixed(2),
        total: docTotal.toFixed(2),
        afip_status: 'not_sent',
      },
      { transaction: t },
    )

    await SalesOrderItem.bulkCreate(
      itemRows.map((row) => ({
        ...row,
        order_id: order.id,
        org_id: ctx.orgId,
      })),
      { transaction: t },
    )

    await deductStockForOrder(
      order.id,
      ctx.orgId,
      verifiedCashierId ?? ctx.orgId,
      t,
    )

    return order
  })
}
