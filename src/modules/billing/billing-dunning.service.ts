import 'server-only'
import { Op } from 'sequelize'
import logger from '@/lib/logger'
import BillingInvoice from './billing-invoice.model'
import OrgSubscription from './org-subscription.model'

/** Mark subscriptions past_due when they have overdue unpaid invoices. */
export async function syncPastDueSubscriptions(): Promise<{ updated: number }> {
  const now = new Date()
  const overdueInvoices = await BillingInvoice.findAll({
    where: {
      status: { [Op.in]: ['issued', 'partially_paid'] },
      due_date: { [Op.lt]: now },
      subscription_id: { [Op.ne]: null },
    },
    attributes: ['subscription_id'],
  })

  const subscriptionIds = [...new Set(
    overdueInvoices.map(i => i.subscription_id).filter((id): id is string => !!id),
  )]

  if (subscriptionIds.length === 0) return { updated: 0 }

  const [updated] = await OrgSubscription.update(
    { status: 'past_due' },
    {
      where: {
        id: { [Op.in]: subscriptionIds },
        status: { [Op.in]: ['active', 'trialing'] },
      },
    },
  )

  if (updated > 0) {
    logger.info({ count: updated }, 'subscriptions marked past_due')
  }

  return { updated }
}

/** Reactivate subscription when all overdue invoices for the org are settled. */
export async function reactivateSubscriptionOnPayment(orgId: string, subscriptionId: string | null): Promise<void> {
  if (!subscriptionId) return

  const sub = await OrgSubscription.findByPk(subscriptionId)
  if (!sub || sub.status !== 'past_due') return

  const now = new Date()
  const hasOverdue = await BillingInvoice.count({
    where: {
      org_id: orgId,
      status: { [Op.in]: ['issued', 'partially_paid'] },
      due_date: { [Op.lt]: now },
    },
  })

  if (hasOverdue === 0) {
    await sub.update({ status: 'active' })
    logger.info({ subscriptionId, orgId }, 'subscription reactivated after payment')
  }
}
