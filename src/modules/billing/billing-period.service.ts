import 'server-only'
import type { Transaction } from 'sequelize'
import OrgSubscription from './org-subscription.model'
import BillingPlan from './billing-plan.model'

export function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

export function endOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999))
}

/** Resolve billing period bounds for a subscription. */
export function resolveSubscriptionPeriod(sub: OrgSubscription): { periodStart: Date; periodEnd: Date } {
  const now = new Date()
  return {
    periodStart: sub.current_period_start ?? startOfMonthUTC(now),
    periodEnd: sub.current_period_end ?? now,
  }
}

function addMonthsUTC(d: Date, months: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1))
}

/** Compute the next billing period after the current one ends. */
export function computeNextPeriod(
  currentEnd: Date,
  interval: 'monthly' | 'annual',
): { periodStart: Date; periodEnd: Date } {
  const nextStart = new Date(currentEnd)
  nextStart.setUTCDate(nextStart.getUTCDate() + 1)
  nextStart.setUTCHours(0, 0, 0, 0)

  if (interval === 'annual') {
    const end = new Date(Date.UTC(nextStart.getUTCFullYear() + 1, nextStart.getUTCMonth(), nextStart.getUTCDate(), 23, 59, 59, 999))
    end.setUTCDate(end.getUTCDate() - 1)
    return { periodStart: nextStart, periodEnd: end }
  }

  const monthStart = startOfMonthUTC(addMonthsUTC(nextStart, 0))
  return {
    periodStart: monthStart,
    periodEnd: endOfMonthUTC(monthStart),
  }
}

export async function advanceSubscriptionPeriod(
  subscriptionId: string,
  t: Transaction,
): Promise<void> {
  const sub = await OrgSubscription.findByPk(subscriptionId, {
    include: [{ model: BillingPlan, as: 'plan' }],
    transaction: t,
  })
  if (!sub) return

  const plan = (sub as unknown as { plan: BillingPlan | null }).plan
  const interval = (plan?.interval === 'annual' ? 'annual' : 'monthly') as 'monthly' | 'annual'
  const { periodEnd } = resolveSubscriptionPeriod(sub)
  const next = computeNextPeriod(periodEnd, interval)

  await sub.update(
    { current_period_start: next.periodStart, current_period_end: next.periodEnd },
    { transaction: t },
  )
}
