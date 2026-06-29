import 'server-only'
import { Op } from 'sequelize'
import Decimal from 'decimal.js'
import logger from '@/lib/logger'
import OrgSubscription from './org-subscription.model'
import { resolveSubscriptionPeriod } from './billing-period.service'
import { countStorageUsage } from './billing-counts.service'
import { getOrgSubscription } from './org-billing.service'
import { upsertMeteredUsage } from './usage-meter.service'
import { STORAGE_GB_METRIC_KEY, STORAGE_FILES_METRIC_KEY } from './billing-metrics.catalog'

const BYTES_PER_GB = new Decimal(1024).pow(3) // GiB, matching FILE_MAX_BYTES (binary) conventions

export type MeterOrgStorageUsageOptions = {
  actorId?: string | null
  /** Avoid a second lookup when the caller already loaded the subscription (rollup job). */
  subscription?: OrgSubscription
}

export type StorageRollupOrgResult = {
  orgId: string
  bytes: string
  files: number
  gb: string
}

export type StorageRollupResult = {
  processed: number
  orgs: StorageRollupOrgResult[]
}

/**
 * Snapshots one org's storage footprint into `usage_records` for the current billing period.
 * Gauge metric: one row per `(subscription, metric, storage:<periodStart>)`, overwritten on
 * each call. Meter-only — never blocks uploads/deletes.
 */
export async function meterOrgStorageUsage(
  orgId: string,
  options: MeterOrgStorageUsageOptions = {},
): Promise<StorageRollupOrgResult | null> {
  const sub = options.subscription ?? await getOrgSubscription(orgId)
  if (!sub) return null

  const { bytes, files } = await countStorageUsage(orgId)
  const gb = new Decimal(bytes).div(BYTES_PER_GB).toDecimalPlaces(4).toString()
  const { periodStart } = resolveSubscriptionPeriod(sub)
  const sourceId = `storage:${periodStart.toISOString().slice(0, 10)}`
  const meterInput = { orgId, period: periodStart, sourceId, actorId: options.actorId ?? null }

  await upsertMeteredUsage({ ...meterInput, metricKey: STORAGE_GB_METRIC_KEY, quantity: gb })
  await upsertMeteredUsage({ ...meterInput, metricKey: STORAGE_FILES_METRIC_KEY, quantity: files })

  return { orgId, bytes, files, gb }
}

/**
 * Meters each org's storage footprint into `usage_records` as a gauge snapshot for the current
 * billing period (one upserted row per metric, keyed by `storage:<periodStart>`). Bytes are
 * billed as `storage_gb`; object count as `storage_files`. Meter-only — never blocks uploads.
 * Idempotent within a period; safe to run daily (reconciliation).
 */
export async function runStorageUsageRollup(): Promise<StorageRollupResult> {
  const subs = await OrgSubscription.findAll({
    where: { status: { [Op.ne]: 'cancelled' }, org_id: { [Op.ne]: null } },
  })

  const orgs: StorageRollupOrgResult[] = []
  for (const sub of subs) {
    const orgId = sub.org_id
    if (!orgId) continue

    const result = await meterOrgStorageUsage(orgId, { subscription: sub })
    if (result) orgs.push(result)
  }

  logger.info({ processed: orgs.length }, 'storage usage rollup completed')
  return { processed: orgs.length, orgs }
}
