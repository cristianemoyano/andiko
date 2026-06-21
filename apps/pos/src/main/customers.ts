import type { IpcMain } from 'electron'
import { eq, like, or, sql } from 'drizzle-orm'
import { db } from './db'
import { customers } from '../db/schema'
import type { PosCustomer } from '@andiko/shared'

export function registerCustomersHandlers(ipc: IpcMain) {
  ipc.handle('customers:get', async (_e, id: string): Promise<PosCustomer | null> => {
    const row = db().select().from(customers).where(eq(customers.id, id)).get()
    return (row as PosCustomer | undefined) ?? null
  })

  ipc.handle('customers:search', async (_e, query: string): Promise<PosCustomer[]> => {
    const d = db()
    const q = query.trim()
    const term = `%${q}%`

    const rows = q
      ? d
          .select()
          .from(customers)
          .where(
            or(
              like(customers.legal_name, term),
              like(sql`coalesce(${customers.trade_name}, '')`, term),
              like(sql`coalesce(${customers.cuit}, '')`, term),
            ),
          )
          .limit(30)
          .all()
      : d.select().from(customers).limit(30).all()

    return rows as PosCustomer[]
  })
}

