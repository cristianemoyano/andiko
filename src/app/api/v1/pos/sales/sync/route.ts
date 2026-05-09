import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withPosDevice } from '@/lib/pos-auth'
import sequelize from '@/lib/db'
import User from '@/modules/auth/user.model'
import SalesOrder from '@/modules/sales/sales-order.model'
import SalesOrderItem from '@/modules/sales/sales-order-item.model'
import { nextDocumentNumber } from '@/modules/sales/sales.utils'
import Decimal from 'decimal.js'
import type { IvaRate } from '@/modules/catalog/product.model'

const saleItemSchema = z.object({
  variant_id: z.string().uuid().optional(),
  description: z.string().default('Producto POS'),
  qty: z.number().positive(),
  unit_price: z.string().regex(/^\d+(\.\d{1,4})?$/),
  iva_rate: z.enum(['0', '10.5', '21', '27']).default('21'),
})

const salePaymentSchema = z.object({
  payment_method_id: z.string().uuid(),
  payment_method_name: z.string().min(1).max(128),
  payment_method_type: z.string().min(1).max(64),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  reference: z.string().max(255).nullable().optional(),
})

const saleSchema = z.object({
  pos_sale_id: z.string(),
  customer_id: z.string().uuid().optional(),
  cashier_user_id: z.string().uuid().optional(),
  cashier_name: z.string().min(1).max(120).optional(),
  payments: z.array(salePaymentSchema).min(1),
  sold_at: z.string().datetime({ offset: true }),
  items: z.array(saleItemSchema).min(1),
})

const bodySchema = z.object({
  sales: z.array(saleSchema).min(1).max(100),
})

function calcItem(qty: number, unitPrice: string, ivaRate: IvaRate) {
  // POS sends unit_price as final consumer price (IVA incluido).
  // Derive net/tax split to persist in ERP totals.
  const unitGross = new Decimal(unitPrice)
  const quantity = new Decimal(qty)
  const gross = unitGross.mul(quantity).toDecimalPlaces(2)
  const rate = new Decimal(ivaRate).div(100)
  const divisor = new Decimal(1).add(rate)
  const taxBase = gross.div(divisor).toDecimalPlaces(2)
  const taxAmount = gross.sub(taxBase).toDecimalPlaces(2)
  const total = gross
  const subtotal = taxBase
  return {
    subtotal: subtotal.toFixed(2),
    taxBase: taxBase.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    total: total.toFixed(2),
  }
}

export const POST = withPosDevice(async (req: NextRequest, ctx) => {
  const body = await req.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  const results: Array<{ pos_sale_id: string; cloud_id: string | null; error: string | null }> = []

  for (const sale of parsed.data.sales) {
    try {
      if (!ctx.branchId) {
        results.push({ pos_sale_id: sale.pos_sale_id, cloud_id: null, error: 'Device has no branch assigned' })
        continue
      }
      const branchId = ctx.branchId

      // Verify cashier exists in this org before using as FK
      let verifiedCashierId: string | null = null
      if (sale.cashier_user_id) {
        const cashier = await User.findOne({ where: { id: sale.cashier_user_id, org_id: ctx.orgId }, attributes: ['id'] })
        verifiedCashierId = cashier?.id ?? null
      }

      const cloudOrder = await sequelize.transaction(async (t) => {
        const orderNumber = await nextDocumentNumber(ctx.orgId, branchId, 'order', t)

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
            branch_id: branchId,
            contact_id: sale.customer_id ?? null,
            source: 'pos',
            pos_device_id: ctx.deviceId,
            pos_sale_id: sale.pos_sale_id,
            salesperson_id: verifiedCashierId,
            order_number: orderNumber,
            status: 'confirmed',
            payment_condition: 'cash',
            currency: 'ARS',
            notes: `POS ${ctx.deviceId}${sale.cashier_name ? ` / ${sale.cashier_name}` : ''}${sale.cashier_user_id ? ` (#${sale.cashier_user_id})` : ''} · ${sale.payments.map(p => p.payment_method_name).join('+')} · ${sale.pos_sale_id}`,
            subtotal: docSubtotal.toFixed(2),
            discount_amount: '0.00',
            tax_amount: docTaxAmount.toFixed(2),
            total: docTotal.toFixed(2),
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

        return order
      })

      results.push({ pos_sale_id: sale.pos_sale_id, cloud_id: cloudOrder.id, error: null })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      results.push({ pos_sale_id: sale.pos_sale_id, cloud_id: null, error: msg })
    }
  }

  const failed = results.filter((r) => r.error !== null).length
  return NextResponse.json({ results, synced: results.length - failed, failed }, { status: 200 })
})
