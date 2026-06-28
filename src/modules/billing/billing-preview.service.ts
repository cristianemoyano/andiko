import 'server-only'
import OrgSubscription from './org-subscription.model'
import SubscriptionAddon from './subscription-addon.model'
import SubscriptionExtra from './subscription-extra.model'
import SubscriptionMetricAllowance from './subscription-metric-allowance.model'
import BillingPlan from './billing-plan.model'
import {
  buildSubscriptionChargeInput,
  buildChargeLines,
  chargeLinesToPreviewLines,
  type BillingChargeWarning,
} from './billing-charges.service'
import { resolveSubscriptionPeriod } from './billing-period.service'
import { getOrgCurrentUsage } from './org-billing.service'

export type BillingPreviewLine = {
  kind: 'base' | 'adjustment' | 'seat' | 'branch' | 'site' | 'module_addon' | 'extra_addon' | 'usage'
  label: string
  quantity: string
  unit_price: string
  amount: string
  detail?: string
  isInformational?: boolean
}

export type BillingPreview = {
  period_start: string
  period_end: string
  lines: BillingPreviewLine[]
  subtotal: string
  tax_amount: string
  total: string
  counts: {
    active_users: number
    active_branches: number
    contracted_seats: number
    included_seats: number
    included_branches: number
    active_sites: number
    included_sites: number
  }
  warnings: BillingChargeWarning[]
}

const SUBSCRIPTION_INCLUDE = [
  { model: BillingPlan, as: 'plan' },
  { model: SubscriptionAddon, as: 'addons' },
  { model: SubscriptionExtra, as: 'extras' },
  { model: SubscriptionMetricAllowance, as: 'metric_allowances' },
]

export async function getSubscriptionBillingPreview(subscriptionId: string): Promise<BillingPreview> {
  const sub = await OrgSubscription.findByPk(subscriptionId, { include: SUBSCRIPTION_INCLUDE })
  if (!sub) throw new Error('SUBSCRIPTION_NOT_FOUND')

  const plan = (sub as unknown as { plan: BillingPlan | null }).plan
  if (!plan) throw new Error('PLAN_NOT_FOUND')

  const { periodStart, periodEnd } = resolveSubscriptionPeriod(sub)
  const { chargeInput, seatCount, branchCount, siteCount, contractedSeats, warnings } = await buildSubscriptionChargeInput(
    sub,
    periodStart,
    periodEnd,
  )
  const { lines, totals } = buildChargeLines(chargeInput)

  const counts = {
    active_users: seatCount,
    active_branches: branchCount,
    contracted_seats: contractedSeats,
    included_seats: plan.included_seats,
    included_branches: plan.included_branches,
    active_sites: siteCount,
    included_sites: plan.included_sites,
  }

  return {
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    lines: chargeLinesToPreviewLines(lines),
    subtotal: totals.subtotal,
    tax_amount: totals.tax_amount,
    total: totals.total,
    counts,
    warnings,
  }
}

export async function getSubscriptionUsageAndPreview(subscriptionId: string) {
  const sub = await OrgSubscription.findByPk(subscriptionId, { include: SUBSCRIPTION_INCLUDE })
  if (!sub) throw new Error('SUBSCRIPTION_NOT_FOUND')

  const [usage, preview] = await Promise.all([
    getOrgCurrentUsage(sub),
    getSubscriptionBillingPreview(subscriptionId),
  ])

  return { usage, preview }
}
