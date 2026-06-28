import 'server-only'
import type { Transaction } from 'sequelize'
import WoocommerceSyncQueue from './woocommerce-sync-queue.model'
import type { WooSyncKind } from './woocommerce-sync-queue.model'

/**
 * Appends a job to the WooCommerce transactional outbox. When called with the
 * caller's `transaction`, the job is committed atomically with the change it
 * describes (e.g. a stock movement), so it is never lost and never fires for a
 * rolled-back change. A separate worker drains the queue and calls the Woo API.
 */
export async function enqueue(params: {
  orgId: string
  siteId: string
  kind: WooSyncKind
  payload: Record<string, unknown>
  t?: Transaction
}): Promise<void> {
  await WoocommerceSyncQueue.create(
    {
      org_id: params.orgId,
      site_id: params.siteId,
      kind: params.kind,
      payload: params.payload,
      status: 'pending',
      attempts: 0,
      next_attempt_at: new Date(),
    },
    { transaction: params.t },
  )
}
