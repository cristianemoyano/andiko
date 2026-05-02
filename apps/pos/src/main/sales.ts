import type { IpcMain } from 'electron'
import { db } from './db'
import { sales, saleItems, syncQueue, products, settings } from '../db/schema'
import { randomUUID } from 'crypto'
import type { PosSale } from '@andiko/shared'
import { desc, eq, sql } from 'drizzle-orm'

export function registerSalesHandlers(ipc: IpcMain) {
  ipc.handle('sales:create', async (_e, payload: PosSale) => {
    const d = db()
    const now = new Date().toISOString()
    const id = payload.local_id || randomUUID()

    const s = d.select().from(settings).all()
    const settingsMap = Object.fromEntries(s.map(r => [r.key, r.value]))

    d.insert(sales).values({
      id,
      customer_id:    payload.customer_id ?? null,
      cashier_user_id: payload.cashier_user_id ?? settingsMap['cashier_user_id'] ?? null,
      cashier_name:   payload.cashier_name ?? settingsMap['cashier_name'] ?? null,
      payment_method: payload.payment_method,
      subtotal:       payload.subtotal,
      tax_amount:     payload.tax_amount,
      total:          payload.total,
      sold_at:        payload.sold_at || now,
    }).run()

    for (const item of payload.items) {
      const p = d.select({ iva_rate: products.iva_rate }).from(products).where(eq(products.id, item.product_id)).get()
      d.insert(saleItems).values({
        sale_id:      id,
        product_id:   item.product_id,
        product_name: item.product_name,
        qty:          item.qty,
        iva_rate:     p?.iva_rate ?? '21',
        unit_price:   item.unit_price,
        total:        item.total,
      }).run()
    }

    d.insert(syncQueue).values({
      sale_id:    id,
      attempts:   0,
      created_at: now,
    }).run()

    return { id }
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
    return { sale: s, items }
  })

  ipc.handle('sales:closingReport', async (_e, date?: string) => {
    const day = date ?? new Date().toISOString().slice(0, 10)
    const rows = db()
      .select({
        payment_method: sales.payment_method,
        count: sql<number>`count(*)`,
        total: sql<string>`coalesce(sum(cast(${sales.total} as real)), 0)`,
      })
      .from(sales)
      .where(sql`strftime('%Y-%m-%d', ${sales.sold_at}) = ${day}`)
      .groupBy(sales.payment_method)
      .all()

    const report = { cash: 0, card: 0, transfer: 0, total: 0, count: 0 }
    for (const row of rows) {
      const amount = Number(row.total)
      const count = Number(row.count)
      if (row.payment_method === 'cash')     report.cash     += amount
      if (row.payment_method === 'card')     report.card     += amount
      if (row.payment_method === 'transfer') report.transfer += amount
      report.total += amount
      report.count += count
    }
    return { ...report, date: day }
  })
}
