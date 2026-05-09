import type { IpcMain } from 'electron'
import { randomUUID } from 'crypto'
import { and, desc, eq } from 'drizzle-orm'
import { db } from './db'
import { posDraftSaleItems, posDraftSales, products, saleItems, sales, settings, syncQueue } from '../db/schema'
import type { PosSalePayment } from '@andiko/shared'

type DraftSaleRow = typeof posDraftSales.$inferSelect
type DraftSaleItemRow = typeof posDraftSaleItems.$inferSelect

export function registerDraftSalesHandlers(ipc: IpcMain) {
  ipc.handle('draftSales:getActive', async () => {
    const row = db()
      .select()
      .from(posDraftSales)
      .where(eq(posDraftSales.status, 'draft'))
      .orderBy(desc(posDraftSales.updated_at))
      .limit(1)
      .get()
    if (!row) return { ok: true, data: null as null | DraftSaleRow }
    return { ok: true, data: row }
  })

  ipc.handle('draftSales:list', async (_e, args?: { status?: string; limit?: number }) => {
    const status = (args?.status ?? 'draft') as string
    const limit = Math.min(Math.max(args?.limit ?? 100, 1), 500)
    const rows = db()
      .select()
      .from(posDraftSales)
      .where(eq(posDraftSales.status, status))
      .orderBy(desc(posDraftSales.updated_at))
      .limit(limit)
      .all()
    return { ok: true, data: rows }
  })

  ipc.handle('draftSales:get', async (_e, draftSaleId: string) => {
    const sale = db().select().from(posDraftSales).where(eq(posDraftSales.id, draftSaleId)).get()
    if (!sale) return { ok: true, data: null as null | { sale: DraftSaleRow; items: DraftSaleItemRow[] } }
    const items = db()
      .select()
      .from(posDraftSaleItems)
      .where(eq(posDraftSaleItems.draft_sale_id, draftSaleId))
      .orderBy(posDraftSaleItems.sort_order)
      .all()
    return { ok: true, data: { sale, items } }
  })

  ipc.handle(
    'draftSales:createOrResume',
    async (
      _e,
      args?: {
        draft_sale_id?: string
        cashier_user_id?: string | null
        cashier_name?: string | null
        customer_id?: string | null
      },
    ) => {
      const d = db()
      const now = new Date().toISOString()

      if (args?.draft_sale_id) {
        const existing = d.select().from(posDraftSales).where(eq(posDraftSales.id, args.draft_sale_id)).get()
        if (existing) {
          d.update(posDraftSales)
            .set({ last_opened_at: now, updated_at: now })
            .where(eq(posDraftSales.id, args.draft_sale_id))
            .run()
          return { ok: true, id: args.draft_sale_id }
        }
      }

      const id = randomUUID()
      d.insert(posDraftSales)
        .values({
          id,
          status: 'draft',
          cashier_user_id: args?.cashier_user_id ?? null,
          cashier_name: args?.cashier_name ?? null,
          customer_id: args?.customer_id ?? null,
          payments: '[]',
          subtotal: '0',
          tax_amount: '0',
          total: '0',
          last_opened_at: now,
          created_at: now,
          updated_at: now,
        })
        .run()
      return { ok: true, id }
    },
  )

  ipc.handle(
    'draftSales:update',
    async (
      _e,
      args: {
        draft_sale_id: string
        cashier_user_id?: string | null
        cashier_name?: string | null
        customer_id?: string | null
        subtotal?: string
        tax_amount?: string
        total?: string
      },
    ) => {
      const now = new Date().toISOString()
      const patch: Partial<DraftSaleRow> = { updated_at: now }
      if ('cashier_user_id' in args) patch.cashier_user_id = args.cashier_user_id ?? null
      if ('cashier_name' in args) patch.cashier_name = args.cashier_name ?? null
      if ('customer_id' in args) patch.customer_id = args.customer_id ?? null
      if (args.subtotal !== undefined) patch.subtotal = args.subtotal
      if (args.tax_amount !== undefined) patch.tax_amount = args.tax_amount
      if (args.total !== undefined) patch.total = args.total

      db().update(posDraftSales).set(patch).where(eq(posDraftSales.id, args.draft_sale_id)).run()
      return { ok: true }
    },
  )

  ipc.handle(
    'draftSaleItems:upsert',
    async (
      _e,
      args: {
        draft_sale_id: string
        product_id: string
        product_name: string
        qty: number
        unit_price: string
        total: string
        iva_rate?: string
        sort_order?: number
      },
    ) => {
      const d = db()
      const p = d
        .select({ iva_rate: products.iva_rate })
        .from(products)
        .where(eq(products.id, args.product_id))
        .get()

      const iva_rate = args.iva_rate ?? p?.iva_rate ?? '21'
      const sort_order = args.sort_order ?? 0

      d.insert(posDraftSaleItems)
        .values({
          draft_sale_id: args.draft_sale_id,
          product_id: args.product_id,
          product_name: args.product_name,
          qty: args.qty,
          iva_rate,
          unit_price: args.unit_price,
          total: args.total,
          sort_order,
        })
        .onConflictDoUpdate({
          target: [posDraftSaleItems.draft_sale_id, posDraftSaleItems.product_id],
          set: {
            product_name: args.product_name,
            qty: args.qty,
            iva_rate,
            unit_price: args.unit_price,
            total: args.total,
            sort_order,
          },
        })
        .run()

      d.update(posDraftSales)
        .set({ updated_at: new Date().toISOString() })
        .where(eq(posDraftSales.id, args.draft_sale_id))
        .run()

      return { ok: true }
    },
  )

  ipc.handle('draftSaleItems:remove', async (_e, args: { draft_sale_id: string; product_id: string }) => {
    const d = db()
    d.delete(posDraftSaleItems)
      .where(and(eq(posDraftSaleItems.draft_sale_id, args.draft_sale_id), eq(posDraftSaleItems.product_id, args.product_id)))
      .run()
    d.update(posDraftSales).set({ updated_at: new Date().toISOString() }).where(eq(posDraftSales.id, args.draft_sale_id)).run()
    return { ok: true }
  })

  ipc.handle(
    'draftSales:checkout',
    async (
      _e,
      args: {
        draft_sale_id: string
        payments: PosSalePayment[]
        sold_at?: string
        subtotal: string
        tax_amount: string
        total: string
      },
    ) => {
      const d = db()
      const now = new Date().toISOString()
      const draft = d.select().from(posDraftSales).where(eq(posDraftSales.id, args.draft_sale_id)).get()
      if (!draft) return { ok: false, error: 'DRAFT_NOT_FOUND' }

      const items = d.select().from(posDraftSaleItems).where(eq(posDraftSaleItems.draft_sale_id, args.draft_sale_id)).all()
      if (items.length === 0) return { ok: false, error: 'EMPTY_DRAFT' }

      const s = d.select().from(settings).all()
      const settingsMap = Object.fromEntries(s.map((r) => [r.key, r.value]))

      const paymentsJson = JSON.stringify(args.payments)
      const saleId = randomUUID()
      d.insert(sales)
        .values({
          id: saleId,
          customer_id: draft.customer_id ?? null,
          cashier_user_id: draft.cashier_user_id ?? settingsMap['cashier_user_id'] ?? null,
          cashier_name: draft.cashier_name ?? settingsMap['cashier_name'] ?? null,
          payments: paymentsJson,
          subtotal: args.subtotal,
          tax_amount: args.tax_amount,
          total: args.total,
          sold_at: args.sold_at ?? now,
        })
        .run()

      for (const item of items) {
        d.insert(saleItems)
          .values({
            sale_id: saleId,
            product_id: item.product_id,
            product_name: item.product_name,
            qty: item.qty,
            iva_rate: item.iva_rate ?? '21',
            unit_price: item.unit_price,
            total: item.total,
          })
          .run()
      }

      d.insert(syncQueue).values({ sale_id: saleId, attempts: 0, created_at: now }).run()

      d.update(posDraftSales)
        .set({
          status: 'paid',
          payments: paymentsJson,
          subtotal: args.subtotal,
          tax_amount: args.tax_amount,
          total: args.total,
          updated_at: now,
        })
        .where(eq(posDraftSales.id, args.draft_sale_id))
        .run()

      return { ok: true, sale_id: saleId }
    },
  )

  ipc.handle('draftSales:cancel', async (_e, draft_sale_id: string) => {
    const now = new Date().toISOString()
    db().update(posDraftSales)
      .set({ status: 'cancelled', updated_at: now })
      .where(eq(posDraftSales.id, draft_sale_id))
      .run()
    return { ok: true }
  })
}

