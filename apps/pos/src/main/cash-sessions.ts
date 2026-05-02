import type { IpcMain } from 'electron'
import { db } from './db'
import { cashSessions, sales } from '../db/schema'
import { randomUUID } from 'crypto'
import { eq, desc, sql } from 'drizzle-orm'

export function registerCashSessionHandlers(ipc: IpcMain) {
  ipc.handle('cashSessions:getCurrent', async () => {
    return db().select().from(cashSessions).where(eq(cashSessions.status, 'open')).get() ?? null
  })

  ipc.handle('cashSessions:open', async (_e, args: {
    cashier_user_id?: string | null
    cashier_name?: string | null
    opening_amount: string
  }) => {
    const existing = db().select().from(cashSessions).where(eq(cashSessions.status, 'open')).get()
    if (existing) return { ok: false, error: 'Ya hay un turno abierto', session: existing }

    const id = randomUUID()
    const now = new Date().toISOString()
    db().insert(cashSessions).values({
      id,
      cashier_user_id: args.cashier_user_id ?? null,
      cashier_name:    args.cashier_name ?? null,
      opened_at:       now,
      opening_amount:  args.opening_amount,
      status:          'open',
    }).run()

    const session = db().select().from(cashSessions).where(eq(cashSessions.id, id)).get()
    return { ok: true, session }
  })

  ipc.handle('cashSessions:close', async (_e, args: {
    session_id: string
    closing_amount_declared: string
  }) => {
    const session = db().select().from(cashSessions).where(eq(cashSessions.id, args.session_id)).get()
    if (!session) return { ok: false, error: 'Turno no encontrado' }
    if (session.status === 'closed') return { ok: false, error: 'El turno ya está cerrado' }

    // Calculate expected: opening + all cash sales during the session
    const openedAt = session.opened_at
    const cashTotal = db()
      .select({ total: sql<string>`coalesce(sum(cast(total as real)), 0)` })
      .from(sales)
      .where(sql`payment_method = 'cash' AND sold_at >= ${openedAt}`)
      .get()

    const expected = (Number(session.opening_amount) + Number(cashTotal?.total ?? 0)).toFixed(2)
    const declared = Number(args.closing_amount_declared).toFixed(2)
    const difference = (Number(declared) - Number(expected)).toFixed(2)
    const now = new Date().toISOString()

    db().update(cashSessions).set({
      status:                   'closed',
      closed_at:                now,
      closing_amount_declared:  declared,
      closing_amount_expected:  expected,
      difference,
    }).where(eq(cashSessions.id, args.session_id)).run()

    const updated = db().select().from(cashSessions).where(eq(cashSessions.id, args.session_id)).get()
    return { ok: true, session: updated }
  })

  ipc.handle('cashSessions:list', async (_e, args?: { limit?: number }) => {
    const limit = Math.min(args?.limit ?? 50, 200)
    return db().select().from(cashSessions).orderBy(desc(cashSessions.opened_at)).limit(limit).all()
  })

  ipc.handle('cashSessions:get', async (_e, sessionId: string) => {
    return db().select().from(cashSessions).where(eq(cashSessions.id, sessionId)).get() ?? null
  })
}
