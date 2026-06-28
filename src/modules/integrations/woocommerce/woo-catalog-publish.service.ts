import 'server-only'
import { randomUUID } from 'node:crypto'
import { Op, QueryTypes } from 'sequelize'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import ProductVariant from '@/modules/catalog/product-variant.model'
import WoocommerceSyncQueue from './woocommerce-sync-queue.model'
import type WoocommerceSite from './woocommerce-site.model'

export type CatalogPublishRunStatus = 'idle' | 'running' | 'completed' | 'cancelled'

export interface CatalogPublishStatus {
  status: CatalogPublishRunStatus
  run_id: string | null
  total: number
  processed: number
  failed: number
  pending: number
  started_at: string | null
}

interface ActiveCatalogPublishRun {
  runId: string
  siteId: string
  orgId: string
  total: number
  startedAt: Date
  cancelled: boolean
  /** Variants published in this session (finer-grained than job-level DB counts). */
  variantsDone: number
}

const activeRuns = new Map<string, ActiveCatalogPublishRun>()

/** When set, all catalog-publish workers for the site must stop immediately. */
const catalogPublishStoppedSites = new Set<string>()

/** Small batches so progress and cancel feel responsive in the UI. */
export const CATALOG_PUBLISH_BATCH_SIZE = 3

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function variantCount(payload: Record<string, unknown>): number {
  const ids = payload.variant_ids
  return Array.isArray(ids) ? ids.length : 0
}

export function isCatalogPublishCancelledForSite(siteId: string): boolean {
  return catalogPublishStoppedSites.has(siteId)
}

export function isCatalogPublishRunCancelled(siteId: string, runId: string): boolean {
  if (catalogPublishStoppedSites.has(siteId)) return true
  const run = activeRuns.get(siteId)
  if (!run || run.runId !== runId) return false
  return run.cancelled
}

export function recordCatalogPublishVariantProcessed(siteId: string, runId: string): void {
  if (catalogPublishStoppedSites.has(siteId)) return
  const run = activeRuns.get(siteId)
  if (run && run.runId === runId) {
    run.variantsDone += 1
  }
}

async function haltAllCatalogPublishJobsForSite(siteId: string): Promise<void> {
  await sequelize.query(
    `DELETE FROM woocommerce_sync_queue
     WHERE site_id = :siteId
       AND kind = 'product'
       AND status = 'pending'
       AND payload->>'catalog_publish_run_id' IS NOT NULL`,
    { replacements: { siteId }, type: QueryTypes.DELETE },
  )
  await sequelize.query(
    `UPDATE woocommerce_sync_queue
     SET status = 'done', last_error = 'catalog publish cancelled', updated_at = NOW()
     WHERE site_id = :siteId
       AND kind = 'product'
       AND status = 'processing'
       AND payload->>'catalog_publish_run_id' IS NOT NULL`,
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
      kind: 'product',
      [Op.and]: [
        sequelize.where(
          sequelize.literal("payload->>'catalog_publish_run_id'"),
          runId,
        ),
      ],
    },
    attributes: ['status', 'payload', 'created_at'],
    order: [['created_at', 'ASC']],
  })

  let total = 0
  let processed = 0
  let failed = 0
  let pending = 0
  let startedAt: Date | null = null

  for (const job of jobs) {
    const n = variantCount(job.payload)
    total += n
    if (job.status === 'done') processed += n
    else if (job.status === 'error') failed += n
    else pending += n
    if (!startedAt) startedAt = job.created_at
  }

  return { total, processed, failed, pending, started_at: startedAt }
}

async function findActiveRunIdFromDb(siteId: string): Promise<string | null> {
  const rows = await sequelize.query<{ run_id: string }>(
    `SELECT payload->>'catalog_publish_run_id' AS run_id
     FROM woocommerce_sync_queue
     WHERE site_id = :siteId
       AND kind = 'product'
       AND status IN ('pending', 'processing')
       AND payload->>'catalog_publish_run_id' IS NOT NULL
     LIMIT 1`,
    { replacements: { siteId }, type: QueryTypes.SELECT },
  )
  return rows[0]?.run_id ?? null
}

async function enqueueCatalogPublishBatches(
  site: WoocommerceSite,
  runId: string,
  ids: string[],
): Promise<void> {
  const now = new Date()
  const rows = chunk(ids, CATALOG_PUBLISH_BATCH_SIZE).map((batch) => ({
    org_id: site.org_id!,
    site_id: site.id,
    kind: 'product' as const,
    payload: { variant_ids: batch, catalog_publish_run_id: runId },
    status: 'pending' as const,
    attempts: 0,
    next_attempt_at: now,
  }))

  for (const group of chunk(rows, 200)) {
    await WoocommerceSyncQueue.bulkCreate(group)
  }
}

/** Starts (or replaces) a background catalog publish for a site. */
export async function startCatalogPublish(site: WoocommerceSite): Promise<CatalogPublishStatus> {
  catalogPublishStoppedSites.delete(site.id)
  await haltAllCatalogPublishJobsForSite(site.id)
  activeRuns.delete(site.id)

  const runId = randomUUID()
  const variants = await ProductVariant.findAll({
    where: { org_id: site.org_id },
    attributes: ['id'],
  })
  const ids = variants.map((v) => v.id)

  const startedAt = new Date()
  activeRuns.set(site.id, {
    runId,
    siteId: site.id,
    orgId: site.org_id!,
    total: ids.length,
    startedAt,
    cancelled: false,
    variantsDone: 0,
  })

  await enqueueCatalogPublishBatches(site, runId, ids)

  logger.info({ siteId: site.id, runId, queued: ids.length }, 'woocommerce catalog publish queued')

  return {
    status: 'running',
    run_id: runId,
    total: ids.length,
    processed: 0,
    failed: 0,
    pending: ids.length,
    started_at: startedAt.toISOString(),
  }
}

/** Cancels a running catalog publish and drops pending jobs for that run. */
export async function cancelCatalogPublish(siteId: string, orgId: string): Promise<CatalogPublishStatus> {
  let run = activeRuns.get(siteId)
  if (!run || run.orgId !== orgId) {
    const runId = await findActiveRunIdFromDb(siteId)
    if (!runId) {
      return getCatalogPublishStatus(siteId, orgId)
    }
    const counts = await countRunJobs(siteId, runId)
    run = {
      runId,
      siteId,
      orgId,
      total: counts.total,
      startedAt: counts.started_at ?? new Date(),
      cancelled: false,
      variantsDone: counts.processed,
    }
    activeRuns.set(siteId, run)
  }

  run.cancelled = true
  catalogPublishStoppedSites.add(siteId)
  await haltAllCatalogPublishJobsForSite(siteId)

  const counts = await countRunJobs(siteId, run.runId)
  logger.info({ siteId, runId: run.runId, ...counts }, 'woocommerce catalog publish cancelled')

  return {
    status: 'cancelled',
    run_id: run.runId,
    total: run.total,
    processed: counts.processed,
    failed: counts.failed,
    pending: counts.pending,
    started_at: run.startedAt.toISOString(),
  }
}

/** Progress for the active (or last) catalog publish on a site. */
export async function getCatalogPublishStatus(siteId: string, orgId: string): Promise<CatalogPublishStatus> {
  let run = activeRuns.get(siteId)

  if (!run || run.orgId !== orgId) {
    const runId = await findActiveRunIdFromDb(siteId)
    if (!runId) {
      if (catalogPublishStoppedSites.has(siteId)) {
        return { status: 'cancelled', run_id: null, total: 0, processed: 0, failed: 0, pending: 0, started_at: null }
      }
      return { status: 'idle', run_id: null, total: 0, processed: 0, failed: 0, pending: 0, started_at: null }
    }
    const counts = await countRunJobs(siteId, runId)
    run = {
      runId,
      siteId,
      orgId,
      total: counts.total,
      startedAt: counts.started_at ?? new Date(),
      cancelled: false,
      variantsDone: counts.processed,
    }
    activeRuns.set(siteId, run)
  }

  const counts = await countRunJobs(siteId, run.runId)
  let status: CatalogPublishRunStatus = 'running'
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
    run_id: run.runId,
    total: Math.max(run.total, counts.total),
    processed: Math.max(counts.processed, run.variantsDone),
    failed: counts.failed,
    pending: counts.pending,
    started_at: run.startedAt.toISOString(),
  }
}
