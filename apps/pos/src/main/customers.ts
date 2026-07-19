import type { IpcMain } from 'electron'
import { eq, like, or, sql } from 'drizzle-orm'
import { db } from './db'
import { customers } from '../db/schema'
import type { PosCustomer } from '@andiko/shared'

function toPosCustomer(row: typeof customers.$inferSelect): PosCustomer {
  return {
    id: row.id,
    legal_name: row.legal_name,
    trade_name: row.trade_name ?? null,
    cuit: row.cuit ?? null,
    iva_condition: row.iva_condition ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    is_system: Boolean(row.is_system),
    system_key: row.system_key ?? null,
    updated_at: row.synced_at,
  }
}

export function registerCustomersHandlers(ipc: IpcMain) {
  ipc.handle('customers:get', async (_e, id: string): Promise<PosCustomer | null> => {
    const row = db().select().from(customers).where(eq(customers.id, id)).get()
    return row ? toPosCustomer(row) : null
  })

  ipc.handle('customers:getSystemConsumidorFinal', async (): Promise<PosCustomer | null> => {
    const row = db()
      .select()
      .from(customers)
      .where(eq(customers.system_key, 'consumidor_final'))
      .get()
    return row ? toPosCustomer(row) : null
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

    return rows.map(toPosCustomer)
  })
}

