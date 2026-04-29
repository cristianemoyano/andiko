import type { IpcMain } from 'electron'
import { like, or, eq, and } from 'drizzle-orm'
import { db } from './db'
import { products } from '../db/schema'
import type { PosProduct } from '@andiko/shared'

export function registerProductsHandlers(ipc: IpcMain) {
  ipc.handle('products:search', async (_e, query: string): Promise<PosProduct[]> => {
    const d = db()
    const trimmed = query.trim()
    const term = `%${trimmed}%`

    const rows = trimmed
      ? d
          .select()
          .from(products)
          .where(
            and(
              eq(products.is_active, true),
              or(
                eq(products.barcode, trimmed),   // exact barcode match first
                like(products.name, term),
                like(products.sku, term),
              ),
            ),
          )
          .limit(40)
          .all()
      : d
          .select()
          .from(products)
          .where(eq(products.is_active, true))
          .limit(40)
          .all()

    return rows as PosProduct[]
  })
}
