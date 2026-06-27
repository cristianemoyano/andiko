import 'server-only'
import type { Transaction } from 'sequelize'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { whereAllowedBranches, type TenantContext } from '@/lib/tenancy'
import SalesRefund from './sales-refund.model'
import { nextDocumentNumber } from './sales.utils'
import type { RefundMethod } from './sales-refund.model'

export type CreateSalesRefundInput = {
  return_id: string
  credit_note_id?: string | null
  amount: string
  refund_method: RefundMethod
  refund_date?: Date
  reference?: string | null
  notes?: string | null
  payment_id?: string | null
}

export async function createSalesRefund(
  input: CreateSalesRefundInput,
  ctx: TenantContext,
  existingTransaction?: Transaction,
) {
  const run = async (t: Transaction) => {
    const { orgId, userId } = ctx
    if (!orgId) throw new Error('ORG_CONTEXT_REQUIRED')

    const SalesReturn = (await import('./sales-return.model')).default
    const salesReturn = await SalesReturn.findOne({
      where: whereAllowedBranches(ctx, { id: input.return_id }),
      transaction: t,
    })
    if (!salesReturn) throw new Error('SALES_RETURN_NOT_FOUND')
    if (!salesReturn.branch_id) throw new Error('BRANCH_REQUIRED')

    const refund_number = await nextDocumentNumber(orgId, salesReturn.branch_id, 'sales_refund', t)

    const refund = await SalesRefund.create(
      {
        org_id:         orgId,
        branch_id:      salesReturn.branch_id,
        return_id:      input.return_id,
        credit_note_id: input.credit_note_id ?? null,
        payment_id:     input.payment_id ?? null,
        refund_number,
        amount:         input.amount,
        refund_method:  input.refund_method,
        refund_date:    input.refund_date ?? new Date(),
        reference:      input.reference ?? null,
        notes:          input.notes ?? null,
        created_by:     userId ?? null,
        updated_by:     userId ?? null,
      },
      { transaction: t },
    )

    logger.info({ refundId: refund.id, returnId: input.return_id }, 'sales refund created')
    return refund
  }

  if (existingTransaction) return run(existingTransaction)
  return sequelize.transaction(run)
}
