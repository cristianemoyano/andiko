import 'server-only'
import { Op } from 'sequelize'
import logger from '@/lib/logger'
import WoocommerceSite from './woocommerce-site.model'
import WoocommerceSyncQueue from './woocommerce-sync-queue.model'
import { buildClientForSite } from './woo-sites.service'
import { enqueue } from './woo-queue'
import { processProductJob } from './woo-catalog.service'
import { processStockJob } from './woo-stock.service'
import { processOrderIngestJob } from './woo-orders.service'

const MAX_ATTEMPTS = 5

function backoffSeconds(attempts: number): number {
  return Math.min(60 * 2 ** attempts, 3600)
}

/**
 * Drains pending outbox jobs whose `next_attempt_at` has passed, dispatching each
 * to its kind's handler. Successes are marked `done`; failures are retried with
 * exponential backoff up to MAX_ATTEMPTS, then parked as `error`.
 */
const STUCK_PROCESSING_MS = 10 * 60 * 1000

export async function drainQueue(limit = 100): Promise<{ processed: number; failed: number }> {
  const now = new Date()
  const staleBefore = new Date(now.getTime() - STUCK_PROCESSING_MS)
  const jobs = await WoocommerceSyncQueue.findAll({
    where: {
      [Op.or]: [
        { status: 'pending', next_attempt_at: { [Op.lte]: now } },
        // Reclaim jobs left 'processing' by a crashed worker.
        { status: 'processing', updated_at: { [Op.lte]: staleBefore } },
      ],
    },
    order: [['created_at', 'ASC']],
    limit,
  })

  let processed = 0
  let failed = 0
  const siteCache = new Map<string, WoocommerceSite | null>()

  for (const job of jobs) {
    // Atomically claim the job with optimistic concurrency: the UPDATE only
    // succeeds if the row is still exactly as we read it (same status and
    // updated_at). Concurrent ticks see 0 rows affected and skip, so a job is
    // never processed twice and active jobs are never stolen.
    const [claimed] = await WoocommerceSyncQueue.update(
      { status: 'processing' },
      { where: { id: job.id, status: job.status, updated_at: job.updated_at } },
    )
    if (claimed === 0) continue

    try {
      let site = siteCache.get(job.site_id)
      if (site === undefined) {
        site = await WoocommerceSite.findByPk(job.site_id)
        siteCache.set(job.site_id, site)
      }
      if (!site || !site.is_active) {
        await job.update({ status: 'done', last_error: 'site inactive or missing' })
        continue
      }

      if (job.kind === 'product') await processProductJob(site, job.payload)
      else if (job.kind === 'stock') await processStockJob(site, job.payload)
      else if (job.kind === 'order_ingest') await processOrderIngestJob(site, job.payload)

      await job.update({ status: 'done', last_error: null })
      processed += 1
    } catch (err) {
      const attempts = job.attempts + 1
      const parked = attempts >= MAX_ATTEMPTS
      await job.update({
        attempts,
        status: parked ? 'error' : 'pending',
        last_error: String(err).slice(0, 1000),
        next_attempt_at: new Date(Date.now() + backoffSeconds(attempts) * 1000),
      })
      failed += 1
      logger.warn({ jobId: job.id, kind: job.kind, attempts, parked, err: String(err) }, 'woocommerce sync job failed')
    }
  }

  return { processed, failed }
}

/**
 * Polling reconciliation: for every active site, pulls orders modified since the
 * last successful poll and enqueues them for ingestion (idempotent), then advances
 * the site's watermark. Catches webhook deliveries that were missed.
 */
export async function pollOrdersForAllSites(): Promise<{ sites: number; queued: number }> {
  const sites = await WoocommerceSite.findAll({ where: { is_active: true } })
  let queued = 0

  for (const site of sites) {
    try {
      const client = buildClientForSite(site)
      const after = site.last_order_synced_at ? new Date(site.last_order_synced_at).toISOString() : undefined
      const orders = await client.listOrders({ after })
      for (const order of orders) {
        await enqueue({ orgId: site.org_id!, siteId: site.id, kind: 'order_ingest', payload: { woo_order_id: order.id } })
        queued += 1
      }
      await site.update({ last_order_synced_at: new Date() })
    } catch (err) {
      logger.warn({ siteId: site.id, err: String(err) }, 'woocommerce order poll failed')
    }
  }

  return { sites: sites.length, queued }
}

/** One full sync tick: poll for new orders, then drain the outbox. */
export async function runSyncTick(): Promise<{
  poll: { sites: number; queued: number }
  drain: { processed: number; failed: number }
}> {
  const poll = await pollOrdersForAllSites()
  const drain = await drainQueue()
  return { poll, drain }
}
