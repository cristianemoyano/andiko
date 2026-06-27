import { eq } from 'drizzle-orm'
import { db } from './db'
import { products, saleItems, sales, syncQueue } from '../db/schema'
import type { PosSalePayment } from '@andiko/shared'
import {
  authorizePosSaleInCloud,
  registerPosSaleInCloud,
  type AuthorizePosSalePayload,
  type CloudFiscalAuthorizeResult,
} from './sync'

export type PosCheckoutResult = {
  sale_id: string
  ticket_number: string | null
  cloud_id: string | null
  cae: string | null
  cae_expiration: string | null
  qr_url: string | null
  afip_status: string
  fiscal_pending: boolean
  afip_error: string | null
}

export type PosCheckoutItem = {
  product_id: string
  product_name: string
  qty: number
  unit_price: string
  total: string
  iva_rate?: string
}

export type PosCheckoutLocalRow = {
  customer_id: string | null
  cashier_user_id: string | null
  cashier_name: string | null
  payments: string
  subtotal: string
  tax_amount: string
  total: string
  sold_at: string
}

function parseCloudError(err: unknown): string {
  if (!(err instanceof Error)) return String(err)
  const msg = err.message
  const jsonStart = msg.indexOf('{')
  if (jsonStart >= 0) {
    try {
      const body = JSON.parse(msg.slice(jsonStart)) as { error?: string; code?: string }
      if (body.error) return body.error
      if (body.code) return body.code
    } catch {
      /* ignore */
    }
  }
  return msg
}

function fiscalFromCloud(fiscal: CloudFiscalAuthorizeResult): Pick<
  PosCheckoutResult,
  'ticket_number' | 'cloud_id' | 'cae' | 'cae_expiration' | 'qr_url' | 'afip_status' | 'fiscal_pending' | 'afip_error'
> {
  return {
    ticket_number: fiscal.ticket_number,
    cloud_id: fiscal.cloud_id,
    cae: fiscal.cae,
    cae_expiration: fiscal.cae_expiration,
    qr_url: fiscal.qr_url,
    afip_status: fiscal.afip_status,
    fiscal_pending: fiscal.afip_status !== 'authorized' || !fiscal.cae,
    afip_error: null,
  }
}

function applyFiscalUpdate(
  saleId: string,
  fiscal: CloudFiscalAuthorizeResult,
  syncedAt: string,
): void {
  db()
    .update(sales)
    .set({
      ticket_number: fiscal.ticket_number,
      cloud_id: fiscal.cloud_id,
      synced_at: syncedAt,
      cae: fiscal.cae,
      cae_expiration: fiscal.cae_expiration,
      qr_url: fiscal.qr_url,
      afip_status: fiscal.afip_status,
    })
    .where(eq(sales.id, saleId))
    .run()
}

export function buildAuthorizePayloadFromLocalSale(saleId: string): AuthorizePosSalePayload {
  const sale = db().select().from(sales).where(eq(sales.id, saleId)).get()
  if (!sale) throw new Error('SALE_NOT_FOUND')

  const items = db().select().from(saleItems).where(eq(saleItems.sale_id, saleId)).all()
  const payments = JSON.parse(sale.payments ?? '[]') as PosSalePayment[]

  return {
    pos_sale_id: saleId,
    customer_id: sale.customer_id ?? undefined,
    cashier_user_id: sale.cashier_user_id ?? undefined,
    cashier_name: sale.cashier_name ?? undefined,
    payments,
    sold_at: sale.sold_at,
    items: items.map((item) => ({
      product_id: item.product_id,
      description: item.product_name,
      qty: item.qty,
      unit_price: item.unit_price,
      iva_rate: item.iva_rate ?? '21',
    })),
  }
}

/** Saves sale locally, registers in cloud, then requests AFIP CAE (best-effort). */
export async function completePosCheckout(args: {
  saleId: string
  payload: AuthorizePosSalePayload
  localRow: PosCheckoutLocalRow
  items: PosCheckoutItem[]
}): Promise<PosCheckoutResult> {
  const d = db()
  const now = new Date().toISOString()

  d.insert(sales)
    .values({
      id: args.saleId,
      ticket_number: null,
      customer_id: args.localRow.customer_id,
      cashier_user_id: args.localRow.cashier_user_id,
      cashier_name: args.localRow.cashier_name,
      payments: args.localRow.payments,
      subtotal: args.localRow.subtotal,
      tax_amount: args.localRow.tax_amount,
      total: args.localRow.total,
      sold_at: args.localRow.sold_at,
      cloud_id: null,
      synced_at: null,
      cae: null,
      cae_expiration: null,
      qr_url: null,
      afip_status: 'pending',
    })
    .run()

  for (const item of args.items) {
    const p = d
      .select({ iva_rate: products.iva_rate })
      .from(products)
      .where(eq(products.id, item.product_id))
      .get()
    d.insert(saleItems)
      .values({
        sale_id: args.saleId,
        product_id: item.product_id,
        product_name: item.product_name,
        qty: item.qty,
        iva_rate: p?.iva_rate ?? item.iva_rate ?? '21',
        unit_price: item.unit_price,
        total: item.total,
      })
      .run()
  }

  let cloudId: string | null = null
  let registerError: string | null = null

  try {
    const reg = await registerPosSaleInCloud(args.payload)
    cloudId = reg.cloud_id
    d.update(sales)
      .set({ cloud_id: reg.cloud_id, synced_at: now })
      .where(eq(sales.id, args.saleId))
      .run()
  } catch (err) {
    registerError = parseCloudError(err)
    const existing = d.select().from(syncQueue).where(eq(syncQueue.sale_id, args.saleId)).get()
    if (!existing) {
      d.insert(syncQueue).values({
        sale_id: args.saleId,
        attempts: 0,
        last_error: registerError,
        created_at: now,
      }).run()
    }
  }

  try {
    const fiscal = await authorizePosSaleInCloud(args.payload)
    applyFiscalUpdate(args.saleId, fiscal, now)
    const pending = d.select().from(syncQueue).where(eq(syncQueue.sale_id, args.saleId)).get()
    if (pending) d.delete(syncQueue).where(eq(syncQueue.id, pending.id)).run()
    return { sale_id: args.saleId, ...fiscalFromCloud(fiscal) }
  } catch (err) {
    const afipError = parseCloudError(err)
    d.update(sales)
      .set({ afip_status: 'pending' })
      .where(eq(sales.id, args.saleId))
      .run()
    return {
      sale_id: args.saleId,
      ticket_number: null,
      cloud_id: cloudId,
      cae: null,
      cae_expiration: null,
      qr_url: null,
      afip_status: 'pending',
      fiscal_pending: true,
      afip_error: registerError ?? afipError,
    }
  }
}

/** Re-requests AFIP CAE for an existing local sale (from sales history). */
export async function authorizeFiscalForLocalSale(saleId: string): Promise<PosCheckoutResult> {
  const sale = db().select().from(sales).where(eq(sales.id, saleId)).get()
  if (!sale) throw new Error('SALE_NOT_FOUND')

  if (sale.cae && sale.afip_status === 'authorized') {
    return {
      sale_id: saleId,
      ticket_number: sale.ticket_number,
      cloud_id: sale.cloud_id,
      cae: sale.cae,
      cae_expiration: sale.cae_expiration,
      qr_url: sale.qr_url,
      afip_status: sale.afip_status ?? 'authorized',
      fiscal_pending: false,
      afip_error: null,
    }
  }

  const payload = buildAuthorizePayloadFromLocalSale(saleId)
  const now = new Date().toISOString()

  if (!sale.cloud_id) {
    try {
      const reg = await registerPosSaleInCloud(payload)
      db()
        .update(sales)
        .set({ cloud_id: reg.cloud_id, synced_at: now })
        .where(eq(sales.id, saleId))
        .run()
    } catch (err) {
      throw new Error(parseCloudError(err))
    }
  }

  try {
    const fiscal = await authorizePosSaleInCloud(payload)
    applyFiscalUpdate(saleId, fiscal, now)
    const pending = db().select().from(syncQueue).where(eq(syncQueue.sale_id, saleId)).get()
    if (pending) db().delete(syncQueue).where(eq(syncQueue.id, pending.id)).run()
    return { sale_id: saleId, ...fiscalFromCloud(fiscal) }
  } catch (err) {
    throw new Error(parseCloudError(err))
  }
}
