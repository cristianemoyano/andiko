import type { IpcMain } from 'electron'
import { db } from './db'
import { products, customers, posUsers, posPaymentMethods, sales, saleItems, syncQueue, settings, cashSessions } from '../db/schema'
import { eq, inArray, isNull, like, or, and, sql } from 'drizzle-orm'
import type { PosProduct, PosCustomer, PosPaymentMethod, PosSalePayment } from '@andiko/shared'
import bcrypt from 'bcryptjs'

const SYNC_INTERVAL_MS = 30 * 60 * 1000  // 30 min for catalog
const SALES_SYNC_INTERVAL_MS = 60 * 1000  // 60 sec for sales

type CloudPosUser = {
  id: string
  name: string
  email: string
  role: string
  role_label: string
  branch_id: string | null
  updated_at: string
  pos_pin_hash: string | null
}

const BUILTIN_ROLE_LABELS: Record<string, string> = {
  admin: 'Gerente',
  'branch-admin': 'Encargado de sucursal',
  operator: 'Operativo (legacy)',
  readonly: 'Solo lectura',
  'sys-admin': 'Sys-admin',
}

function displayRoleLabel(role: string, roleLabel: string | null | undefined): string {
  const trimmed = roleLabel?.trim()
  if (trimmed) return trimmed
  return BUILTIN_ROLE_LABELS[role] ?? role
}

function upsertPosUsersFromCloud(userList: CloudPosUser[]) {
  const syncedUserIds = new Set<string>()
  for (const u of userList) {
    syncedUserIds.add(u.id)
    const roleLabel = displayRoleLabel(u.role, u.role_label)
    db().insert(posUsers).values({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      role_label: roleLabel,
      branch_id: u.branch_id ?? null,
      pos_pin_hash: u.pos_pin_hash ?? null,
      synced_at: u.updated_at,
    }).onConflictDoUpdate({ target: posUsers.id, set: {
      name: u.name,
      email: u.email,
      role: u.role,
      role_label: roleLabel,
      branch_id: u.branch_id ?? null,
      pos_pin_hash: u.pos_pin_hash ?? null,
      synced_at: u.updated_at,
    }}).run()
  }
  const localUsers = db().select({ id: posUsers.id }).from(posUsers).all()
  for (const row of localUsers) {
    if (!syncedUserIds.has(row.id)) {
      db().delete(posUsers).where(eq(posUsers.id, row.id)).run()
    }
  }
  return syncedUserIds
}

async function refreshPosUsersFromCloud(): Promise<void> {
  const { data: userList } = await fetchCloud<{ data: CloudPosUser[] }>(
    `/api/v1/pos/users?limit=100`,
    { method: 'GET' },
  )
  upsertPosUsersFromCloud(userList)

  const s = getSettings()
  const nextUsersSince =
    userList.length > 0
      ? userList
          .map((u) => u.updated_at)
          .reduce((max, cur) => (cur > max ? cur : max), '1970-01-01T00:00:00.000Z')
      : (s['users_synced_at'] ?? '1970-01-01T00:00:00.000Z')
  db().insert(settings).values({ key: 'users_synced_at', value: nextUsersSince })
    .onConflictDoUpdate({ target: settings.key, set: { value: nextUsersSince } }).run()
}

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
    balanza_config?: unknown
    fiscal?: {
      legal_name: string | null
      trade_name: string | null
      cuit: string | null
      iva_condition: string | null
      fiscal_address: string | null
      gross_income: string | null
      activity_start_date: string | null
      consumer_defense_line: string | null
      comprobante_codigo: string | null
    } | null
    branch_fiscal?: {
      address: string | null
      establishment_code: string | null
      punto_venta: number | null
      branch_punto_venta: number | null
    } | null
    device_fiscal?: {
      punto_venta: number | null
    } | null
  }>(`/api/v1/pos/license?device_id=${encodeURIComponent(deviceId)}`)

  if (res.valid) {
    if (res.branch_id)   saveSetting('branch_id', res.branch_id)
    if (res.branch_name) saveSetting('branch_name', res.branch_name)
    if (res.org_id)      saveSetting('org_id', res.org_id)
    if (res.org_name)    saveSetting('org_name', res.org_name)
    if (res.device_id)   saveSetting('device_id', res.device_id)
    if (res.device_name) saveSetting('device_name', res.device_name)
    if (res.valid_until) saveSetting('license_valid_until', res.valid_until)
    if (res.balanza_config !== undefined) {
      saveSetting('balanza_config', JSON.stringify(res.balanza_config))
    }
    if (res.fiscal) {
      saveSetting('org_legal_name', res.fiscal.legal_name ?? '')
      saveSetting('org_cuit', res.fiscal.cuit ?? '')
      saveSetting('org_iva_condition', res.fiscal.iva_condition ?? '')
      saveSetting('org_fiscal_address', res.fiscal.fiscal_address ?? '')
      saveSetting('org_gross_income', res.fiscal.gross_income ?? '')
      saveSetting('org_activity_start', res.fiscal.activity_start_date ?? '')
      saveSetting('org_consumer_defense', res.fiscal.consumer_defense_line ?? '')
      saveSetting('org_comprobante_codigo', res.fiscal.comprobante_codigo ?? '083')
    }
    if (res.branch_fiscal) {
      saveSetting('branch_address', res.branch_fiscal.address ?? '')
      saveSetting('branch_establishment', res.branch_fiscal.establishment_code ?? '')
      saveSetting(
        'branch_punto_venta',
        res.branch_fiscal.punto_venta != null ? String(res.branch_fiscal.punto_venta) : '',
      )
      saveSetting(
        'branch_punto_venta_default',
        res.branch_fiscal.branch_punto_venta != null ? String(res.branch_fiscal.branch_punto_venta) : '',
      )
    }
    if (res.device_fiscal) {
      saveSetting(
        'device_punto_venta',
        res.device_fiscal.punto_venta != null ? String(res.device_fiscal.punto_venta) : '',
      )
    }
    saveSetting('license_last_valid_at', new Date().toISOString())
  } else {
    // Limpiar caché cuando el cloud confirma revocación
    for (const key of [
      'branch_name', 'org_name', 'device_name', 'license_valid_until', 'license_last_valid_at',
      'org_legal_name', 'org_cuit', 'org_iva_condition', 'org_fiscal_address',
      'org_gross_income', 'org_activity_start', 'org_consumer_defense', 'org_comprobante_codigo',
      'branch_address', 'branch_establishment', 'branch_punto_venta', 'branch_punto_venta_default',
      'device_punto_venta',
    ]) {
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
  qs.set('limit', '50')
  return fetchCloud<{ data: Array<{ id: string; name: string; email: string; role: string; role_label: string; branch_id: string | null; updated_at: string; pos_pin_hash: string | null }> }>(
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

export type CloudFiscalAuthorizeResult = {
  pos_sale_id: string
  cloud_id: string
  ticket_number: string
  punto_venta: number
  comprobante_tipo: number
  cbte_numero: number
  cae: string | null
  cae_expiration: string | null
  afip_status: string
  qr_url: string | null
  observations: Array<{ code: number; msg: string }>
}

export type AuthorizePosSalePayload = {
  pos_sale_id: string
  customer_id?: string
  cashier_user_id?: string
  cashier_name?: string
  payments: Array<{
    payment_method_id: string
    payment_method_name: string
    payment_method_type: string
    amount: string
    reference?: string | null
  }>
  sold_at: string
  items: Array<{
    product_id?: string
    description: string
    qty: number
    unit_price: string
    iva_rate: string
  }>
}

/** Registers the POS sale in cloud without AFIP CAE. */
export async function registerPosSaleInCloud(payload: AuthorizePosSalePayload): Promise<{
  pos_sale_id: string
  cloud_id: string
  afip_status: string
}> {
  return fetchCloud(
    '/api/v1/pos/sales/register',
    { method: 'POST', body: JSON.stringify(payload) },
    30_000,
  )
}

/** Requests AFIP CAE in cloud and returns the official ticket number. */
export async function authorizePosSaleInCloud(payload: AuthorizePosSalePayload): Promise<CloudFiscalAuthorizeResult> {
  return fetchCloud<CloudFiscalAuthorizeResult>(
    '/api/v1/pos/sales/authorize',
    { method: 'POST', body: JSON.stringify(payload) },
    60_000,
  )
}

export type PosReturnCloudPayload = {
  pos_local_id: string
  operation_type?: 'return' | 'exchange'
  items: Array<{ product_id: string; quantity: number; description?: string }>
  exchange_items?: Array<{
    product_id: string
    description: string
    quantity: number
    unit_price: number
    iva_rate?: string
  }>
  refund_disposition?: 'account_credit' | 'cash_refund'
}

export async function postPosReturnToCloud(orderId: string, payload: PosReturnCloudPayload) {
  return fetchCloud<Record<string, unknown>>(
    `/api/v1/pos/sales/${orderId}/return`,
    { method: 'POST', body: JSON.stringify(payload) },
    30_000,
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
      image_url: p.image_url ?? null,
      sold_by_weight: p.sold_by_weight ?? false, plu_code: p.plu_code ?? null,
      synced_at: p.updated_at,
    }).onConflictDoUpdate({ target: products.id, set: {
      sku: p.sku ?? null, barcode: p.barcode ?? null, name: p.name, price: p.price,
      iva_rate: p.iva_rate, is_active: p.is_active, image_url: p.image_url ?? null,
      sold_by_weight: p.sold_by_weight ?? false, plu_code: p.plu_code ?? null,
      synced_at: p.updated_at,
    }}).run()
  }

  const { data: customerList } = await fetchCloud<{ data: PosCustomer[] }>(
    `/api/v1/pos/customers?since=${encodeURIComponent(since)}`
  )
  for (const c of customerList) {
    db().insert(customers).values({
      id: c.id, legal_name: c.legal_name, trade_name: c.trade_name ?? null,
      cuit: c.cuit ?? null, iva_condition: c.iva_condition ?? null,
      email: c.email ?? null, phone: c.phone ?? null, synced_at: c.updated_at,
    }).onConflictDoUpdate({ target: customers.id, set: {
      legal_name: c.legal_name, trade_name: c.trade_name ?? null, cuit: c.cuit ?? null,
      iva_condition: c.iva_condition ?? null,
      email: c.email ?? null, phone: c.phone ?? null, synced_at: c.updated_at,
    }}).run()
  }

  // Users (cashiers) — full pull each sync (small set; avoids missing renames when updated_at lags)
  await refreshPosUsersFromCloud()

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
  await reconcileSyncedSales()

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
      product_id:  i.product_id,
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

/** Pull reconciliación: backfill cloud_id para ventas ya sincronizadas en cloud pero pendientes localmente. */
export async function reconcileSyncedSales(): Promise<{ reconciled: number }> {
  const unsynced = db().select().from(sales).where(sql`${sales.cloud_id} IS NULL`).all()
  if (unsynced.length === 0) return { reconciled: 0 }

  const since = unsynced
    .map(s => s.sold_at)
    .reduce((min, cur) => (cur < min ? cur : min), unsynced[0]!.sold_at)

  try {
    const result = await fetchCloud<{ data: Array<{ pos_sale_id: string; cloud_id: string }> }>(
      `/api/v1/pos/sales/sync?since=${encodeURIComponent(since)}&limit=500`,
      { method: 'GET' },
    )

    const now = new Date().toISOString()
    let reconciled = 0
    for (const row of result.data) {
      const local = db().select().from(sales).where(eq(sales.id, row.pos_sale_id)).get()
      if (local && !local.cloud_id) {
        db().update(sales).set({ cloud_id: row.cloud_id, synced_at: now }).where(eq(sales.id, row.pos_sale_id)).run()
        const q = db().select().from(syncQueue).where(eq(syncQueue.sale_id, row.pos_sale_id)).get()
        if (q) db().delete(syncQueue).where(eq(syncQueue.id, q.id)).run()
        reconciled++
      }
    }
    return { reconciled }
  } catch {
    return { reconciled: 0 }
  }
}

export async function runBackgroundSync(): Promise<void> {
  try { await reconcileSyncedSales() } catch { /* offline */ }
  try { await syncPendingSales() } catch { /* offline */ }
  try { await syncPendingCashSessions() } catch { /* offline */ }
}

export async function syncPendingCashSessions() {
  // Pending: never synced, missing cloud_id, or closed after last sync (open was synced but close was not)
  const toSync = db().select().from(cashSessions)
    .where(
      or(
        isNull(cashSessions.synced_at),
        isNull(cashSessions.cloud_id),
        and(
          eq(cashSessions.status, 'closed'),
          sql`${cashSessions.closed_at} IS NOT NULL AND ${cashSessions.synced_at} < ${cashSessions.closed_at}`,
        ),
      ),
    )
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
    try { await reconcileSyncedSales() }
    catch (e) { errors.push(`reconciliación: ${String(e)}`) }
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
    const missingRoleLabel = db()
      .select({ id: posUsers.id })
      .from(posUsers)
      .where(or(isNull(posUsers.role_label), eq(posUsers.role_label, '')))
      .all()
    if (missingRoleLabel.length > 0) {
      try {
        await refreshPosUsersFromCloud()
      } catch {
        // Offline — show best-effort labels from built-in role names
      }
    }

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
              like(sql`coalesce(${posUsers.role_label}, '')`, term),
            ),
          )
          .orderBy(posUsers.name)
          .limit(50)
          .all()
      : d.select().from(posUsers).orderBy(posUsers.name).limit(50).all()

    return {
      ok: true,
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        role_label: displayRoleLabel(row.role, row.role_label),
        branch_id: row.branch_id,
      })),
    }
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

  // Start background timers — pull reconciliación antes de push
  catalogTimer = setInterval(async () => {
    try { await syncCatalog() } catch { /* silent */ }
  }, SYNC_INTERVAL_MS)

  salesTimer = setInterval(async () => {
    try { await runBackgroundSync() } catch { /* silent */ }
  }, SALES_SYNC_INTERVAL_MS)
}
