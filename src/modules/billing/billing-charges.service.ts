import 'server-only'
import { Op } from 'sequelize'
import type { Transaction } from 'sequelize'
import Decimal from 'decimal.js'
import OrgSubscription from './org-subscription.model'
import SubscriptionAddon from './subscription-addon.model'
import SubscriptionExtra from './subscription-extra.model'
import BillingPlan from './billing-plan.model'
import BillingMetric from './billing-metric.model'
import BillingPlanMetricAllowance from './billing-plan-metric-allowance.model'
import SubscriptionMetricAllowance from './subscription-metric-allowance.model'
import { getTrackedBillingMetric } from './billing-metrics.catalog'
import { aggregateUsage } from './usage.service'
import { countActiveUsers, countActiveBranches } from './billing-counts.service'
import { calcSubscriptionCharges, calcBillingTotals, type BillingChargeInput } from './billing.math'
import type { BillingLineKind } from '@/types'

export type UsageLineInput = BillingChargeInput['usage'][number]

export type BillingChargeWarning = {
  code: 'UNCONFIGURED_METRIC' | 'INACTIVE_METRIC'
  metric_key: string
  quantity: string
  message: string
}

export async function buildSubscriptionChargeInput(
  sub: OrgSubscription & {
    plan?: BillingPlan | null
    addons?: SubscriptionAddon[]
    extras?: SubscriptionExtra[]
    metric_allowances?: SubscriptionMetricAllowance[]
  },
  periodStart: Date,
  periodEnd: Date,
  t?: Transaction,
): Promise<{
  chargeInput: BillingChargeInput
  seatCount: number
  branchCount: number
  contractedSeats: number
  usageLines: UsageLineInput[]
  warnings: BillingChargeWarning[]
}> {
  const plan = sub.plan
  if (!plan) throw new Error('PLAN_NOT_FOUND')

  const addons = sub.addons ?? []
  const subscriptionExtras = sub.extras ?? []
  const warnings: BillingChargeWarning[] = []

  const usageTotals = await aggregateUsage(sub.id, periodStart, periodEnd, t)
  const metricKeys = usageTotals.map(u => u.metric_key)
  const metrics = metricKeys.length
    ? await BillingMetric.findAll({ where: { key: { [Op.in]: metricKeys } }, transaction: t })
    : []
  const metricByKey = new Map(metrics.map(m => [m.key, m]))

  const planMetrics = await BillingPlanMetricAllowance.findAll({
    where: { plan_id: plan.id },
    transaction: t,
  })
  const planMetricByKey = new Map(planMetrics.map(a => [a.metric_key, a]))

  const subAllowances = sub.metric_allowances ?? await SubscriptionMetricAllowance.findAll({
    where: { subscription_id: sub.id },
    transaction: t,
  })
  const subAllowanceByKey = new Map(subAllowances.map(a => [a.metric_key, a.extra_included_quantity]))

  const usageLines = usageTotals.flatMap(u => {
    const m = metricByKey.get(u.metric_key)
    const catalogDef = getTrackedBillingMetric(u.metric_key)
    const label = catalogDef?.label ?? u.metric_key

    if (!m) {
      if (new Decimal(u.quantity).gt(0)) {
        warnings.push({
          code: 'UNCONFIGURED_METRIC',
          metric_key: u.metric_key,
          quantity: u.quantity,
          message: `Hay ${trimQty(u.quantity)} de «${label}» registrados pero la métrica no está configurada — no se facturarán.`,
        })
      }
      return []
    }

    if (!m.is_active) {
      if (new Decimal(u.quantity).gt(0)) {
        warnings.push({
          code: 'INACTIVE_METRIC',
          metric_key: u.metric_key,
          quantity: u.quantity,
          message: `Hay ${trimQty(u.quantity)} de «${label}» registrados pero la métrica está inactiva — no se facturarán.`,
        })
      }
      return []
    }

    const planMetric = planMetricByKey.get(u.metric_key)
    const planIncluded = planMetric?.included_quantity ?? '0.0000'
    const subExtra = subAllowanceByKey.get(u.metric_key) ?? '0.0000'
    const unitPrice = planMetric?.unit_price ?? catalogDef?.default_unit_price ?? '0.00'

    return [{
      metric_key: u.metric_key,
      label: m.label,
      unit_label: m.unit_label,
      unit_price: unitPrice,
      quantity: u.quantity,
      included_quantity: sumAllowances(planIncluded, subExtra),
      plan_included_quantity: planIncluded,
      subscription_extra_included: subExtra,
    }]
  })

  const seatCount = sub.org_id ? await countActiveUsers(sub.org_id, t) : 0
  const branchCount = sub.org_id ? await countActiveBranches(sub.org_id, t) : 0
  const contractedSeats = sub.seats

  const chargeInput: BillingChargeInput = {
    plan: {
      name: plan.name,
      base_price: plan.base_price,
      included_seats: plan.included_seats,
      per_seat_price: plan.per_seat_price,
      included_branches: plan.included_branches,
      per_branch_price: plan.per_branch_price,
    },
    seats: seatCount,
    contracted_seats: contractedSeats,
    branches: branchCount,
    addons: addons.map(a => ({ module_key: a.module_key, unit_price: a.unit_price, enabled: a.enabled })),
    extras: subscriptionExtras.map(e => ({ extra_key: e.extra_key, unit_price: e.unit_price, enabled: e.enabled })),
    usage: usageLines,
  }

  return { chargeInput, seatCount, branchCount, contractedSeats, usageLines, warnings }
}

function trimQty(qty: string): string {
  const d = new Decimal(qty)
  return d.mod(1).eq(0) ? d.toFixed(0) : d.toFixed(4).replace(/\.?0+$/, '')
}

function sumAllowances(planQty: string, subExtraQty: string): string {
  return new Decimal(planQty).plus(subExtraQty).toFixed(4)
}

export function buildChargeLines(chargeInput: BillingChargeInput) {
  const lines = calcSubscriptionCharges(chargeInput)
  const totals = calcBillingTotals(lines)
  return { lines, totals }
}

const PREVIEW_KINDS = new Set<BillingLineKind>(['base', 'adjustment', 'seat', 'branch', 'module_addon', 'extra_addon', 'usage'])

export function chargeLinesToPreviewLines(
  lines: ReturnType<typeof calcSubscriptionCharges>,
) {
  return lines
    .filter(l => PREVIEW_KINDS.has(l.kind))
    .map(l => ({
      kind: l.kind as 'base' | 'adjustment' | 'seat' | 'branch' | 'module_addon' | 'extra_addon' | 'usage',
      label: l.description,
      quantity: l.quantity,
      unit_price: l.unit_price,
      amount: l.subtotal,
      detail: l.kind === 'adjustment' ? undefined : undefined,
      isInformational: l.kind === 'adjustment' || new Decimal(l.subtotal).eq(0),
    }))
}
