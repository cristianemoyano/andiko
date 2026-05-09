import type { IpcMain } from 'electron'
import { db } from './db'
import { products, customers, posUsers, posPaymentMethods, sales, saleItems, syncQueue, settings, cashSessions } from '../db/schema'
import { eq, inArray, like, or, sql } from 'drizzle-orm'
import type { PosProduct, PosCustomer, PosPaymentMethod, PosSalePayment } from '@andiko/shared'
import bcrypt from 'bcryptjs'

const SYNC_INTERVAL_MS = 30 * 60 * 1000  // 30 min for catalog
const SALES_SYNC_INTERVAL_MS = 60 * 1000  // 60 sec for sales

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- timers are assigned on startSync() for future stop/restart support
let catalogTimer: ReturnType<typeof setInterval> | null = null
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- timers are assigned on startSync() for future stop/restart support
let salesTimer: ReturnType<typeof setInterval> | null = null

function getSettings() {
  const rows = db().select().from(settings).all()
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

function saveSetting(key: string, value: string) {
  db().insert(settings).values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } }).run()
}

export async function validateLicense(): Promise<{ valid: boolean; reason?: string }> {
  const s = getSettings()
  const deviceId = s['device_id'] ?? ''

  const res = await fetchCloud<{
    valid: boolean
    reason?: string
    org_id?: string
    org_name?: string
    branch_id?: string
    branch_name?: string
    device_id?: string
    device_name?: string
    valid_until?: string
  }>(`/api/v1/pos/license?device_id=${encodeURIComponent(deviceId)}`)

  if (res.valid) {
    if (res.branch_id)   saveSetting('branch_id', res.branch_id)
    if (res.branch_name) saveSetting('branch_name', res.branch_name)
    if (res.org_id)      saveSetting('org_id', res.org_id)
    if (res.org_name)    saveSetting('org_name', res.org_name)
    if (res.device_id)   saveSetting('device_id', res.device_id)
    if (res.device_name) saveSetting('device_name', res.device_name)
    if (res.valid_until) saveSetting('license_valid_until', res.valid_until)
    saveSetting('license_last_valid_at', new Date().toISOString())
  } else {
    // Limpiar caché cuando el cloud confirma revocación
    for (const key of ['branch_name', 'org_name', 'device_name', 'license_valid_until', 'license_last_valid_at']) {
      db().delete(settings).where(eq(settings.key, key)).run()
    }
  }

  return { valid: res.valid, reason: res.reason }
}

async function fetchCloud<T>(path: string, config?: RequestInit, timeoutMs = 10_000): Promise<T> {
  const s = getSettings()
  const base = s['cloud_url'] ?? ''
  const token = s['api_token'] ?? ''

  if (!base) throw new Error('URL del servidor no configurada')
  if (!token) throw new Error('Token de dispositivo no configurado')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${base}${path}`, {
      ...config,
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...config?.headers },
    })
    if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`)
    return res.json() as Promise<T>
  } finally {
    clearTimeout(timer)
  }
}

export async function searchUsers(query: string) {
  const q = query.trim()
  const qs = new URLSearchParams()
  if (q) qs.set('q', q)
  qs.set('limit', '20')
  return fetchCloud<{ data: Array<{ id: string; name: string; email: string; role: string; branch_id: string | null; updated_at: string; pos_pin_hash: string | null }> }>(
    `/api/v1/pos/users?${qs.toString()}`,
    { method: 'GET' },
  )
}

export async function verifyUserPin(args: { user_id: string; pin: string }) {
  return fetchCloud<{ ok: boolean; user?: { id: string; name: string }; error?: string }>(
    '/api/v1/pos/users/verify-pin',
    { method: 'POST', body: JSON.stringify(args) },
    10_000,
  )
}

export async function syncCatalog() {
  const s = getSettings()
  const since = s['catalog_synced_at'] ?? '1970-01-01T00:00:00.000Z'
  const branchId = s['branch_id'] ?? ''

  const { data: productList } = await fetchCloud<{ data: PosProduct[] }>(
    `/api/v1/pos/products?branch_id=${branchId}&since=${encodeURIComponent(since)}`
  )
  for (const p of productList) {
    db().insert(products).values({
      id: p.id, sku: p.sku ?? null, barcode: p.barcode ?? null, name: p.name,
      price: p.price, iva_rate: p.iva_rate, is_active: p.is_active,
      image_url: p.image_url ?? null, synced_at: p.updated_at,
    }).onConflictDoUpdate({ target: products.id, set: {
      sku: p.sku ?? null, barcode: p.barcode ?? null, name: p.name, price: p.price,
      iva_rate: p.iva_rate, is_active: p.is_active, image_url: p.image_url ?? null, synced_at: p.updated_at,
    }}).run()
  }

  const { data: customerList } = await fetchCloud<{ data: PosCustomer[] }>(
    `/api/v1/pos/customers?since=${encodeURIComponent(since)}`
  )
  for (const c of customerList) {
    db().insert(customers).values({
      id: c.id, legal_name: c.legal_name, trade_name: c.trade_name ?? null,
      cuit: c.cuit ?? null, email: c.email ?? null, phone: c.phone ?? null, synced_at: c.updated_at,
    }).onConflictDoUpdate({ target: customers.id, set: {
      legal_name: c.legal_name, trade_name: c.trade_name ?? null, cuit: c.cuit ?? null,
      email: c.email ?? null, phone: c.phone ?? null, synced_at: c.updated_at,
    }}).run()
  }

  // Users (cashiers) — local cache for offline search
  const usersSince = s['users_synced_at'] ?? '1970-01-01T00:00:00.000Z'
  const { data: userList } = await fetchCloud<{ data: Array<{ id: string; name: string; email: string; role: string; branch_id: string | null; updated_at: string; pos_pin_hash: string | null }> }>(
    `/api/v1/pos/users?since=${encodeURIComponent(usersSince)}&limit=50`,
    { method: 'GET' },
  )
  for (const u of userList) {
    db().insert(posUsers).values({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      branch_id: u.branch_id ?? null,
      pos_pin_hash: u.pos_pin_hash ?? null,
      synced_at: u.updated_at,
    }).onConflictDoUpdate({ target: posUsers.id, set: {
      name: u.name,
      email: u.email,
      role: u.role,
      branch_id: u.branch_id ?? null,
      pos_pin_hash: u.pos_pin_hash ?? null,
      synced_at: u.updated_at,
    }}).run()
  }
  // Important: use max(updated_at) from cloud to avoid clock-skew misses.
  // Using "now" can skip updates if server clock is behind or if the update happened just before sync.
  const nextUsersSince =
    userList.length > 0
      ? userList
          .map((u) => u.updated_at)
          .reduce((max, cur) => (cur > max ? cur : max), usersSince)
      : usersSince
  db().insert(settings).values({ key: 'users_synced_at', value: nextUsersSince })
    .onConflictDoUpdate({ target: settings.key, set: { value: nextUsersSince } }).run()

  // Payment methods — branch-scoped, no delta sync needed (small set)
  if (!branchId) throw new Error('Validá la licencia primero para obtener la sucursal asignada')
  const { data: paymentMethodList } = await fetchCloud<{ data: PosPaymentMethod[] }>(
    `/api/v1/pos/payment-methods?branch_id=${branchId}`
  )
  // Full replace — source of truth is cloud, set is small
  db().delete(posPaymentMethods).run()
  for (const pm of paymentMethodList) {
    db().insert(posPaymentMethods).values({
      id: pm.id,
      name: pm.name,
      type: pm.type,
      requires_reference: pm.requires_reference,
      sort_order: pm.sort_order,
      synced_at: pm.updated_at,
    }).run()
  }

  db().insert(settings).values({ key: 'catalog_synced_at', value: new Date().toISOString() })
    .onConflictDoUpdate({ target: settings.key, set: { value: new Date().toISOString() } }).run()
}

export async function syncPendingSales(): Promise<{ synced: number; failed: Array<{ id: string; error: string }> }> {
  const pending = db().select().from(syncQueue).all()
  if (pending.length === 0) return { synced: 0, failed: [] }

  const saleIds = pending.map(q => q.sale_id)
  const saleRows = db().select().from(sales).where(inArray(sales.id, saleIds)).all()
  const itemRows = db().select().from(saleItems).where(inArray(saleItems.sale_id, saleIds)).all()

  const itemsBySaleId = itemRows.reduce<Record<string, typeof itemRows>>((acc, item) => {
    ;(acc[item.sale_id] ??= []).push(item)
    return acc
  }, {})

  const payload = saleRows.map(s => ({
    pos_sale_id:    s.id,
    customer_id:    s.customer_id ?? undefined,
    cashier_user_id: s.cashier_user_id ?? undefined,
    cashier_name:   s.cashier_name ?? undefined,
    payments:       JSON.parse(s.payments ?? '[]') as PosSalePayment[],
    sold_at:        s.sold_at,
    items: (itemsBySaleId[s.id] ?? []).map(i => ({
      variant_id:  i.product_id,
      description: i.product_name,
      qty:         i.qty,
      unit_price:  i.unit_price,
      iva_rate:    (i.iva_rate ?? '21') as '0' | '10.5' | '21' | '27',
    })),
  }))

  const result = await fetchCloud<{ results: Array<{ pos_sale_id: string; cloud_id: string | null; error: string | null }> }>(
    '/api/v1/pos/sales/sync',
    { method: 'POST', body: JSON.stringify({ sales: payload }) },
  )

  const now = new Date().toISOString()
  let synced = 0
  const failed: Array<{ id: string; error: string }> = []

  for (const r of result.results) {
    if (r.cloud_id) {
      db().update(sales).set({ synced_at: now, cloud_id: r.cloud_id }).where(eq(sales.id, r.pos_sale_id)).run()
      const q = pending.find(p => p.sale_id === r.pos_sale_id)
      if (q) db().delete(syncQueue).where(eq(syncQueue.id, q.id)).run()
      synced++
    } else {
      const errMsg = r.error ?? 'Unknown error'
      const q = pending.find(p => p.sale_id === r.pos_sale_id)
      if (q) {
        db().update(syncQueue).set({ attempts: q.attempts + 1, last_error: errMsg })
          .where(eq(syncQueue.id, q.id)).run()
      }
      failed.push({ id: r.pos_sale_id, error: errMsg })
    }
  }

  return { synced, failed }
}

export async function syncPendingCashSessions() {
  // Sync: never synced OR closed but no cloud_id (closed after last sync)
  const toSync = db().select().from(cashSessions)
    .where(sql`${cashSessions.synced_at} IS NULL OR ${cashSessions.cloud_id} IS NULL`)
    .all()

  if (toSync.length === 0) return

  const payload = toSync.map(s => ({
    local_id:                s.id,
    cashier_user_id:         s.cashier_user_id ?? undefined,
    cashier_name:            s.cashier_name ?? undefined,
    opened_at:               s.opened_at,
    closed_at:               s.closed_at ?? undefined,
    opening_amount:          s.opening_amount,
    closing_amount_declared: s.closing_amount_declared ?? undefined,
    closing_amount_expected: s.closing_amount_expected ?? undefined,
    difference:              s.difference ?? undefined,
    status:                  s.status as 'open' | 'closed',
  }))

  const result = await fetchCloud<{ results: Array<{ local_id: string; cloud_id: string | null; error: string | null }> }>(
    '/api/v1/pos/cash-sessions/sync',
    { method: 'POST', body: JSON.stringify({ sessions: payload }) },
  )

  const now = new Date().toISOString()
  const failed: string[] = []
  for (const r of result.results) {
    if (r.cloud_id) {
      db().update(cashSessions).set({ synced_at: now, cloud_id: r.cloud_id })
        .where(eq(cashSessions.id, r.local_id)).run()
    } else {
      failed.push(r.error ?? 'unknown')
    }
  }
  if (failed.length > 0) {
    throw new Error(`${failed.length} turno(s) no sincronizados: ${failed[0]}`)
  }
}

const GRACE_PERIOD_DAYS = 7

export type LicenseCheckResult =
  | { status: 'ok' }
  | { status: 'blocked'; reason: 'revoked' | 'expired' | 'no_config' | 'unknown' }
  | { status: 'grace'; daysLeft: number }

export async function checkLicenseOnStartup(): Promise<LicenseCheckResult> {
  const s = getSettings()
  const cloudUrl = s['cloud_url'] ?? ''
  const apiToken = s['api_token'] ?? ''

  if (!cloudUrl || !apiToken) {
    return { status: 'blocked', reason: 'no_config' }
  }

  // Try cloud validation first
  try {
    const result = await validateLicense()
    if (result.valid) return { status: 'ok' }
    // Cloud explicitly says invalid (revoked)
    return { status: 'blocked', reason: 'revoked' }
  } catch {
    // Offline or unreachable — fall through to grace period logic
  }

  // Offline: check grace period from last successful validation
  const lastValidAt = s['license_last_valid_at']
  if (!lastValidAt) return { status: 'blocked', reason: 'unknown' }

  const daysSinceValid = (Date.now() - new Date(lastValidAt).getTime()) / (1000 * 60 * 60 * 24)
  const daysLeft = Math.floor(GRACE_PERIOD_DAYS - daysSinceValid)

  if (daysLeft > 0) return { status: 'grace', daysLeft }
  return { status: 'blocked', reason: 'expired' }
}

export function registerSyncHandlers(ipc: IpcMain) {
  ipc.handle('license:check', async () => {
    try { return await checkLicenseOnStartup() }
    catch { return { status: 'blocked', reason: 'unknown' } }
  })

  ipc.handle('sync:license', async () => {
    try { return await validateLicense() }
    catch (e) { return { valid: false, reason: String(e) } }
  })

  ipc.handle('sync:catalog', async () => {
    try { await syncCatalog(); return { ok: true } }
    catch (e) { return { ok: false, error: String(e) } }
  })

  ipc.handle('sync:sales', async () => {
    const errors: string[] = []
    let salesResult = { synced: 0, failed: [] as Array<{ id: string; error: string }> }
    try { salesResult = await syncPendingSales() }
    catch (e) { errors.push(`ventas: ${String(e)}`) }
    try { await syncPendingCashSessions() }
    catch (e) { errors.push(`turnos: ${String(e)}`) }
    if (errors.length > 0) return { ok: false, error: errors.join(' | ') }
    if (salesResult.failed.length > 0) {
      const detail = salesResult.failed.map(f => f.error).join(' | ')
      return { ok: false, error: `${salesResult.failed.length} venta(s) fallaron: ${detail}` }
    }
    return { ok: true, synced: salesResult.synced }
  })

  ipc.handle('settings:save', async (_e, kv: Record<string, string>) => {
    for (const [key, value] of Object.entries(kv)) {
      db().insert(settings).values({ key, value })
        .onConflictDoUpdate({ target: settings.key, set: { value } }).run()
    }
    return { ok: true }
  })

  ipc.handle('settings:get', async () => getSettings())

  ipc.handle('paymentMethods:list', async () => {
    return db().select().from(posPaymentMethods).orderBy(posPaymentMethods.sort_order).all()
  })

  ipc.handle('users:search', async (_e, query: string) => {
    const q = (query ?? '').trim()
    const term = `%${q}%`
    const d = db()

    const rows = q
      ? d
          .select()
          .from(posUsers)
          .where(
            or(
              like(posUsers.name, term),
              like(posUsers.email, term),
              like(sql`coalesce(${posUsers.role}, '')`, term),
            ),
          )
          .limit(20)
          .all()
      : d.select().from(posUsers).limit(20).all()

    return { ok: true, data: rows }
  })

  ipc.handle('users:verifyPin', async (_e, args: { user_id: string; pin: string }) => {
    try {
      const res = await verifyUserPin(args)
      return res
    } catch {
      // Offline fallback: validate against locally synced bcrypt hash (if available)
      const row = db().select().from(posUsers).where(eq(posUsers.id, args.user_id)).get()
      const hash = row?.pos_pin_hash
      if (!hash) return { ok: false, error: 'Sin conexión y sin PIN sincronizado para este usuario' }
      const ok = await bcrypt.compare(args.pin, hash)
      if (!ok) return { ok: false, error: 'PIN incorrecto' }
      return { ok: true, user: { id: row!.id, name: row!.name } }
    }
  })

  ipc.handle('dev:resetLocalData', async () => {
    try {
      db().delete(syncQueue).run()
      db().delete(saleItems).run()
      db().delete(sales).run()
      db().delete(posPaymentMethods).run()
      db().delete(posUsers).run()
      db().delete(customers).run()
      db().delete(products).run()
      db().delete(settings).run()
      return { ok: true }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  // Start background timers
  catalogTimer = setInterval(async () => {
    try { await syncCatalog() } catch { /* silent */ }
  }, SYNC_INTERVAL_MS)

  salesTimer = setInterval(async () => {
    try { await syncPendingSales() } catch { /* silent */ }
    try { await syncPendingCashSessions() } catch { /* silent */ }
  }, SALES_SYNC_INTERVAL_MS)
}
