import 'server-only'
import { Op } from 'sequelize'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import type { TenantContext } from '@/lib/tenancy'
import AfipEmission from './afip-emission.model'
import {
  requestCAEForInvoice,
  requestCAEForCreditNote,
  requestCAEForDebitNote,
  type EmissionDeps,
} from './afip-emission.service'

const PENDING_STATUSES = ['pending', 'error'] as const

/** Lists queued emissions awaiting (re)submission to AFIP. */
export async function listPendingEmissions(ctx: TenantContext, page = 1, limit = 20) {
  const { offset } = paginate(page, limit)
  const { rows, count } = await AfipEmission.findAndCountAll({
    where: { org_id: ctx.orgId, status: { [Op.in]: PENDING_STATUSES } },
    order: [['created_at', 'DESC']],
    limit,
    offset,
  })
  return toPaginated(rows, count, page, limit)
}

/**
 * Re-attempts a queued emission. Idempotent: an already-authorized document is
 * skipped by the underlying emission service (throws AFIP_ALREADY_AUTHORIZED).
 */
export async function retryEmission(emissionId: string, ctx: TenantContext, deps: EmissionDeps = {}) {
  const emission = await AfipEmission.findOne({ where: { id: emissionId, org_id: ctx.orgId } })
  if (!emission) throw new Error('EMISSION_NOT_FOUND')
  if (emission.status === 'authorized') throw new Error('EMISSION_ALREADY_AUTHORIZED')

  logger.info({ emissionId, documentType: emission.document_type, documentId: emission.document_id }, 'retrying afip emission')
  return dispatch(emission.document_type, emission.document_id, ctx, deps)
}

/** Re-attempts every pending/error emission for the org. Returns a per-document summary. */
export async function syncPendingEmissions(ctx: TenantContext, deps: EmissionDeps = {}) {
  const pending = await AfipEmission.findAll({
    where: { org_id: ctx.orgId, status: { [Op.in]: PENDING_STATUSES } },
    order: [['created_at', 'ASC']],
  })

  const results: { documentId: string; status: string }[] = []
  for (const emission of pending) {
    try {
      const doc = (await dispatch(emission.document_type, emission.document_id, ctx, deps)) as { afip_status: string }
      results.push({ documentId: emission.document_id, status: doc.afip_status })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      results.push({ documentId: emission.document_id, status: `error:${message}` })
    }
  }
  return results
}

function dispatch(documentType: string, documentId: string, ctx: TenantContext, deps: EmissionDeps) {
  switch (documentType) {
    case 'invoice':
      return requestCAEForInvoice(documentId, ctx, deps)
    case 'credit_note':
      return requestCAEForCreditNote(documentId, ctx, deps)
    case 'debit_note':
      return requestCAEForDebitNote(documentId, ctx, deps)
    case 'sales_order':
      return retryPosOrderEmission(documentId, ctx)
    default:
      throw new Error('UNKNOWN_DOCUMENT_TYPE')
  }
}

/** Re-runs ERP finalize for a POS order that got CAE but failed stock/invoice creation. */
async function retryPosOrderEmission(orderId: string, ctx: TenantContext) {
  const SalesOrder = (await import('@/modules/sales/sales-order.model')).default
  const order = await SalesOrder.findOne({
    where: { id: orderId, org_id: ctx.orgId, source: 'pos' },
    attributes: ['id', 'cae', 'afip_status'],
  })
  if (!order) throw new Error('DOCUMENT_NOT_FOUND')
  if (!order.cae) throw new Error('AFIP_DOCUMENT_NOT_ISSUED')

  const { finalizePosSaleInErp } = await import('@/modules/pos/pos-sales-finalize.service')
  await finalizePosSaleInErp(orderId, ctx.orgId, { requireAfip: true })
  await order.reload()
  return order
}
