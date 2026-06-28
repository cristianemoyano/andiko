import 'server-only'
import { randomUUID } from 'node:crypto'
import { Op, QueryTypes } from 'sequelize'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import WoocommerceSyncQueue from './woocommerce-sync-queue.model'
import type WoocommerceSite from './woocommerce-site.model'
import { buildClientForSite } from './woo-sites.service'
import { customerEmail } from './woo-customers.service'
import {
  collectUnits,
  fetchOrdersForImport,
  importableProductUnits,
  type WooUnit,
} from './woo-import-jobs.service'
import {
  importPreviewCacheKey,
  invalidateImportPreviewSnapshot,
  invalidateOrderImportPreviewSnapshots,
  invalidateCustomerImportPreviewSnapshot,
  customerImportPreviewCacheKey,
} from './woo-import-preview.cache'
import type {
  WoocommerceImportApplyInput,
  WoocommerceImportRunScope,
} from './woocommerce.schema'

export type ImportRunStatus = 'idle' | 'running' | 'completed' | 'cancelled'

export interface ImportRunProgress {
  status: ImportRunStatus
  scope: WoocommerceImportRunScope | null
  run_id: string | null
  total: number
  processed: number
  failed: number
  pending: number
  started_at: string | null
}

interface ActiveImportRun {
  runId: string
  siteId: string
  orgId: string
  scope: WoocommerceImportRunScope
  total: number
  startedAt: Date
  cancelled: boolean
  itemsDone: number
}

const activeRuns = new Map<string, ActiveImportRun>()
const importStoppedSites = new Set<string>()

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export function isImportCancelledForSite(siteId: string): boolean {
  return importStoppedSites.has(siteId)
}

export function isImportRunCancelled(siteId: string, runId: string): boolean {
  if (importStoppedSites.has(siteId)) return true
  const run = activeRuns.get(siteId)
  if (!run || run.runId !== runId) return false
  return run.cancelled
}

export function recordImportItemProcessed(siteId: string, runId: string): void {
  if (importStoppedSites.has(siteId)) return
  const run = activeRuns.get(siteId)
  if (run && run.runId === runId) {
    run.itemsDone += 1
  }
}

async function haltAllImportJobsForSite(siteId: string): Promise<void> {
  await sequelize.query(
    `DELETE FROM woocommerce_sync_queue
     WHERE site_id = :siteId
       AND kind = 'import'
       AND status = 'pending'
       AND payload->>'import_run_id' IS NOT NULL`,
    { replacements: { siteId }, type: QueryTypes.DELETE },
  )
  await sequelize.query(
    `UPDATE woocommerce_sync_queue
     SET status = 'done', last_error = 'import cancelled', updated_at = NOW()
     WHERE site_id = :siteId
       AND kind = 'import'
       AND status = 'processing'
       AND payload->>'import_run_id' IS NOT NULL`,
    { replacements: { siteId }, type: QueryTypes.UPDATE },
  )
}

async function countRunJobs(siteId: string, runId: string): Promise<{
  total: number
  processed: number
  failed: number
  pending: number
  started_at: Date | null
}> {
  const jobs = await WoocommerceSyncQueue.findAll({
    where: {
      site_id: siteId,
      kind: 'import',
      [Op.and]: [
        sequelize.where(
          sequelize.literal("payload->>'import_run_id'"),
          runId,
        ),
      ],
    },
    attributes: ['status', 'created_at'],
    order: [['created_at', 'ASC']],
  })

  const total = jobs.length
  let processed = 0
  let failed = 0
  let pending = 0
  let startedAt: Date | null = null

  for (const job of jobs) {
    if (job.status === 'done') processed += 1
    else if (job.status === 'error') failed += 1
    else pending += 1
    if (!startedAt) startedAt = job.created_at
  }

  return { total, processed, failed, pending, started_at: startedAt }
}

async function findActiveRunIdFromDb(siteId: string): Promise<string | null> {
  const rows = await sequelize.query<{ run_id: string }>(
    `SELECT payload->>'import_run_id' AS run_id
     FROM woocommerce_sync_queue
     WHERE site_id = :siteId
       AND kind = 'import'
       AND status IN ('pending', 'processing')
       AND payload->>'import_run_id' IS NOT NULL
     LIMIT 1`,
    { replacements: { siteId }, type: QueryTypes.SELECT },
  )
  return rows[0]?.run_id ?? null
}

async function enqueueImportJobs(
  site: WoocommerceSite,
  runId: string,
  scope: WoocommerceImportRunScope,
  payloads: Record<string, unknown>[],
): Promise<void> {
  const now = new Date()
  const rows = payloads.map((payload) => ({
    org_id: site.org_id!,
    site_id: site.id,
    kind: 'import' as const,
    payload: { ...payload, import_run_id: runId, import_scope: scope },
    status: 'pending' as const,
    attempts: 0,
    next_attempt_at: now,
  }))

  for (const group of chunk(rows, 200)) {
    await WoocommerceSyncQueue.bulkCreate(group)
  }
}

function invalidatePreviewsForScope(site: WoocommerceSite, scope: WoocommerceImportRunScope): void {
  if (scope === 'products') {
    invalidateImportPreviewSnapshot(importPreviewCacheKey(site.org_id!, site.id))
  } else if (scope === 'orders') {
    invalidateOrderImportPreviewSnapshots(site.org_id!, site.id)
  } else {
    invalidateCustomerImportPreviewSnapshot(customerImportPreviewCacheKey(site.org_id!, site.id))
  }
}

async function buildProductImportPayloads(
  site: WoocommerceSite,
  options: Pick<WoocommerceImportApplyInput, 'import_unmatched_products' | 'stock_baseline'>,
): Promise<Record<string, unknown>[]> {
  const client = buildClientForSite(site)
  const units = importableProductUnits(await collectUnits(client, await client.listProducts()))
  const payloads: Record<string, unknown>[] = units.map((unit: WooUnit) => ({
    step: 'product_unit',
    unit,
    import_unmatched_products: options.import_unmatched_products,
  }))

  if (options.stock_baseline === 'push_erp' || options.stock_baseline === 'seed_from_woo') {
    payloads.push({ step: 'stock_baseline', mode: options.stock_baseline })
  }

  return payloads
}

async function buildOrderImportPayloads(
  site: WoocommerceSite,
  options: Pick<WoocommerceImportApplyInput, 'open_orders_only' | 'orders_since'>,
): Promise<Record<string, unknown>[]> {
  const orders = await fetchOrdersForImport(
    site,
    options.open_orders_only,
    options.orders_since ?? undefined,
  )
  return orders.map((order) => ({
    step: 'order',
    woo_order_id: order.id,
  }))
}

async function buildCustomerImportPayloads(site: WoocommerceSite): Promise<Record<string, unknown>[]> {
  const client = buildClientForSite(site)
  const customers = await client.listCustomers()
  return customers
    .filter((customer) => customerEmail(customer))
    .map((customer) => ({
      step: 'customer',
      woo_customer_id: customer.id,
    }))
}

export async function startImportRun(
  site: WoocommerceSite,
  scope: WoocommerceImportRunScope,
  options: WoocommerceImportApplyInput,
): Promise<ImportRunProgress> {
  importStoppedSites.delete(site.id)
  await haltAllImportJobsForSite(site.id)
  activeRuns.delete(site.id)
  invalidatePreviewsForScope(site, scope)

  const runId = randomUUID()
  let payloads: Record<string, unknown>[] = []

  if (scope === 'products') {
    payloads = await buildProductImportPayloads(site, options)
  } else if (scope === 'orders') {
    payloads = await buildOrderImportPayloads(site, options)
  } else {
    payloads = await buildCustomerImportPayloads(site)
  }

  const startedAt = new Date()
  activeRuns.set(site.id, {
    runId,
    siteId: site.id,
    orgId: site.org_id!,
    scope,
    total: payloads.length,
    startedAt,
    cancelled: false,
    itemsDone: 0,
  })

  if (payloads.length > 0) {
    await enqueueImportJobs(site, runId, scope, payloads)
  }

  logger.info({ siteId: site.id, runId, scope, queued: payloads.length }, 'woocommerce import run queued')

  return {
    status: payloads.length > 0 ? 'running' : 'completed',
    scope,
    run_id: runId,
    total: payloads.length,
    processed: 0,
    failed: 0,
    pending: payloads.length,
    started_at: startedAt.toISOString(),
  }
}

export async function cancelImportRun(siteId: string, orgId: string): Promise<ImportRunProgress> {
  let run = activeRuns.get(siteId)
  if (!run || run.orgId !== orgId) {
    const runId = await findActiveRunIdFromDb(siteId)
    if (!runId) {
      return getImportRunStatus(siteId, orgId)
    }
    const counts = await countRunJobs(siteId, runId)
    run = {
      runId,
      siteId,
      orgId,
      scope: 'products',
      total: counts.total,
      startedAt: counts.started_at ?? new Date(),
      cancelled: false,
      itemsDone: counts.processed,
    }
    activeRuns.set(siteId, run)
  }

  run.cancelled = true
  importStoppedSites.add(siteId)
  await haltAllImportJobsForSite(siteId)

  const counts = await countRunJobs(siteId, run.runId)
  logger.info({ siteId, runId: run.runId, scope: run.scope, ...counts }, 'woocommerce import run cancelled')

  return {
    status: 'cancelled',
    scope: run.scope,
    run_id: run.runId,
    total: run.total,
    processed: counts.processed,
    failed: counts.failed,
    pending: counts.pending,
    started_at: run.startedAt.toISOString(),
  }
}

export async function getImportRunStatus(siteId: string, orgId: string): Promise<ImportRunProgress> {
  let run = activeRuns.get(siteId)

  if (!run || run.orgId !== orgId) {
    const runId = await findActiveRunIdFromDb(siteId)
    if (!runId) {
      if (importStoppedSites.has(siteId)) {
        return {
          status: 'cancelled',
          scope: null,
          run_id: null,
          total: 0,
          processed: 0,
          failed: 0,
          pending: 0,
          started_at: null,
        }
      }
      return {
        status: 'idle',
        scope: null,
        run_id: null,
        total: 0,
        processed: 0,
        failed: 0,
        pending: 0,
        started_at: null,
      }
    }
    const counts = await countRunJobs(siteId, runId)
    const scopeRow = await sequelize.query<{ import_scope: string }>(
      `SELECT payload->>'import_scope' AS import_scope
       FROM woocommerce_sync_queue
       WHERE site_id = :siteId
         AND kind = 'import'
         AND payload->>'import_run_id' = :runId
       LIMIT 1`,
      { replacements: { siteId, runId }, type: QueryTypes.SELECT },
    )
    const scope = (scopeRow[0]?.import_scope ?? 'products') as WoocommerceImportRunScope

    run = {
      runId,
      siteId,
      orgId,
      scope,
      total: counts.total,
      startedAt: counts.started_at ?? new Date(),
      cancelled: false,
      itemsDone: counts.processed,
    }
    activeRuns.set(siteId, run)
  }

  const counts = await countRunJobs(siteId, run.runId)
  let status: ImportRunStatus = 'running'
  if (run.cancelled) {
    status = 'cancelled'
  } else if (counts.pending === 0 && counts.total > 0) {
    status = 'completed'
  } else if (counts.total === 0 && run.total === 0) {
    status = 'completed'
  }

  if (status === 'completed' || (status === 'cancelled' && counts.pending === 0)) {
    activeRuns.delete(siteId)
  }

  return {
    status,
    scope: run.scope,
    run_id: run.runId,
    total: Math.max(run.total, counts.total),
    processed: Math.max(counts.processed, run.itemsDone),
    failed: counts.failed,
    pending: counts.pending,
    started_at: run.startedAt.toISOString(),
  }
}
