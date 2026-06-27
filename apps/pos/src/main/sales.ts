import type { IpcMain } from 'electron'
import { db } from './db'
import { sales, saleItems, customers } from '../db/schema'
import type { PosCustomer, PosSaleReturnPayload } from '@andiko/shared'
import { randomUUID } from 'crypto'
import type { PosSale } from '@andiko/shared'
import { desc, eq, sql } from 'drizzle-orm'
import { completePosCheckout, authorizeFiscalForLocalSale } from './pos-sale-checkout'
import type { AuthorizePosSalePayload } from './sync'
import { postPosReturnToCloud } from './sync'

function buildAuthorizePayload(id: string, payload: PosSale, soldAt: string): AuthorizePosSalePayload {
  return {
    pos_sale_id: id,
    customer_id: payload.customer_id ?? undefined,
    cashier_user_id: payload.cashier_user_id ?? undefined,
    cashier_name: payload.cashier_name ?? undefined,
    payments: payload.payments,
    sold_at: soldAt,
    items: payload.items.map((i) => ({
      product_id: i.product_id,
      description: i.product_name,
      qty: i.qty,
      unit_price: i.unit_price,
      iva_rate: i.iva_rate ?? '21',
    })),
  }
}

export function registerSalesHandlers(ipc: IpcMain) {
  ipc.handle('sales:create', async (_e, payload: PosSale) => {
    const id = payload.local_id || randomUUID()
    const soldAt = payload.sold_at || new Date().toISOString()

    const result = await completePosCheckout({
      saleId: id,
      payload: buildAuthorizePayload(id, payload, soldAt),
      localRow: {
        customer_id: payload.customer_id ?? null,
        cashier_user_id: payload.cashier_user_id ?? null,
        cashier_name: payload.cashier_name ?? null,
        payments: JSON.stringify(payload.payments),
        subtotal: payload.subtotal,
        tax_amount: payload.tax_amount,
        total: payload.total,
        sold_at: soldAt,
      },
      items: payload.items.map((i) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        qty: i.qty,
        unit_price: i.unit_price,
        total: i.total,
        iva_rate: i.iva_rate,
      })),
    })

    return {
      id: result.sale_id,
      ticket_number: result.ticket_number,
      cloud_id: result.cloud_id,
      cae: result.cae,
      cae_expiration: result.cae_expiration,
      qr_url: result.qr_url,
      afip_status: result.afip_status,
      fiscal_pending: result.fiscal_pending,
      afip_error: result.afip_error,
    }
  })

  ipc.handle('sales:authorizeFiscal', async (_e, saleId: string) => {
    const result = await authorizeFiscalForLocalSale(saleId)
    return {
      ok: true as const,
      sale_id: result.sale_id,
      ticket_number: result.ticket_number,
      cloud_id: result.cloud_id,
      cae: result.cae,
      cae_expiration: result.cae_expiration,
      qr_url: result.qr_url,
      afip_status: result.afip_status,
      fiscal_pending: result.fiscal_pending,
    }
  })

  ipc.handle('sales:return', async (_e, payload: PosSaleReturnPayload) => {
    const sale = db().select().from(sales).where(eq(sales.id, payload.sale_id)).get()
    if (!sale) throw new Error('Venta no encontrada')
    if (!sale.cloud_id) throw new Error('La venta aún no está sincronizada con el servidor')

    const localItems = db().select().from(saleItems).where(eq(saleItems.sale_id, payload.sale_id)).all()
    const nameByProductId = new Map(localItems.map(i => [i.product_id, i.product_name]))
    const items = payload.items.map(i => ({
      product_id: i.product_id,
      variant_id: i.product_id,
      quantity: i.quantity,
      description: nameByProductId.get(i.product_id),
    }))
    if (items.length === 0) throw new Error('Indicá al menos un ítem a devolver')

    return postPosReturnToCloud(sale.cloud_id, {
      pos_local_id: payload.pos_local_id,
      operation_type: payload.operation_type ?? 'return',
      items,
      exchange_items: payload.exchange_items,
      refund_disposition: payload.refund_disposition ?? 'account_credit',
    })
  })

  ipc.handle('sales:list-today', async () => {
    const today = new Date().toISOString().slice(0, 10)
    return db().select().from(sales).all().filter(s => s.sold_at.startsWith(today))
  })

  ipc.handle('sales:list', async (_e, args?: { limit?: number }) => {
    const limit = Math.min(Math.max(args?.limit ?? 200, 1), 500)
    return db().select().from(sales).orderBy(desc(sales.sold_at)).limit(limit).all()
  })

  ipc.handle('sales:get', async (_e, saleId: string) => {
    const s = db().select().from(sales).where(eq(sales.id, saleId)).get()
    if (!s) return null
    const items = db().select().from(saleItems).where(eq(saleItems.sale_id, saleId)).all()
    let customer: PosCustomer | null = null
    if (s.customer_id) {
      customer = (db().select().from(customers).where(eq(customers.id, s.customer_id)).get() as PosCustomer | undefined) ?? null
    }
    return { sale: s, items, customer }
  })

  ipc.handle('sales:closingReport', async (_e, date?: string) => {
    const day = date ?? new Date().toISOString().slice(0, 10)
    const rows = db()
      .select({ payments: sales.payments, total: sales.total })
      .from(sales)
      .where(sql`strftime('%Y-%m-%d', ${sales.sold_at}) = ${day}`)
      .all()

    const byType: Record<string, number> = {}
    let grandTotal = 0
    let count = 0

    for (const row of rows) {
      const payments = JSON.parse(row.payments ?? '[]') as PosSale['payments']
      for (const p of payments) {
        byType[p.payment_method_name] = (byType[p.payment_method_name] ?? 0) + Number(p.amount)
      }
      grandTotal += Number(row.total)
      count++
    }

    return { byType, total: grandTotal, count, date: day }
  })
}
