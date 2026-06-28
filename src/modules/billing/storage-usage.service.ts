import 'server-only'
import { Op } from 'sequelize'
import Decimal from 'decimal.js'
import logger from '@/lib/logger'
import OrgSubscription from './org-subscription.model'
import { resolveSubscriptionPeriod } from './billing-period.service'
import { countStorageUsage } from './billing-counts.service'
import { upsertMeteredUsage } from './usage-meter.service'
import { STORAGE_GB_METRIC_KEY, STORAGE_FILES_METRIC_KEY } from './billing-metrics.catalog'

const BYTES_PER_GB = new Decimal(1024).pow(3) // GiB, matching FILE_MAX_BYTES (binary) conventions

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
 * Meters each org's storage footprint into `usage_records` as a gauge snapshot for the current
 * billing period (one upserted row per metric, keyed by `storage:<periodStart>`). Bytes are
 * billed as `storage_gb`; object count as `storage_files`. Meter-only — never blocks uploads.
 * Idempotent within a period; safe to run daily.
 */
export async function runStorageUsageRollup(): Promise<StorageRollupResult> {
  const subs = await OrgSubscription.findAll({
    where: { status: { [Op.ne]: 'cancelled' }, org_id: { [Op.ne]: null } },
  })

  const orgs: StorageRollupOrgResult[] = []
  for (const sub of subs) {
    const orgId = sub.org_id
    if (!orgId) continue

    const { bytes, files } = await countStorageUsage(orgId)
    const gb = new Decimal(bytes).div(BYTES_PER_GB).toDecimalPlaces(4).toString()
    const { periodStart } = resolveSubscriptionPeriod(sub)
    const sourceId = `storage:${periodStart.toISOString().slice(0, 10)}`

    await upsertMeteredUsage({ orgId, metricKey: STORAGE_GB_METRIC_KEY, quantity: gb, period: periodStart, sourceId })
    await upsertMeteredUsage({ orgId, metricKey: STORAGE_FILES_METRIC_KEY, quantity: files, period: periodStart, sourceId })

    orgs.push({ orgId, bytes, files, gb })
  }

  logger.info({ processed: orgs.length }, 'storage usage rollup completed')
  return { processed: orgs.length, orgs }
}
