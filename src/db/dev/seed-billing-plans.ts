import type { Transaction } from 'sequelize'
import { Op } from 'sequelize'
import BillingPlan from '@/modules/billing/billing-plan.model'
import BillingPlanModule from '@/modules/billing/billing-plan-module.model'
import BillingPlanExtra from '@/modules/billing/billing-plan-extra.model'
import BillingPlanMetricAllowance from '@/modules/billing/billing-plan-metric-allowance.model'
import OrgSubscription from '@/modules/billing/org-subscription.model'
import SubscriptionAddon from '@/modules/billing/subscription-addon.model'
import SubscriptionExtra from '@/modules/billing/subscription-extra.model'
import PlatformSetting from '@/modules/auth/platform-setting.model'
import { ORG_MODULE_DEFS, type OrgModuleKey } from '@/modules/auth/organization-modules'
import { BILLING_EXTRA_DEFS, type BillingExtraKey } from '@/modules/billing/billing-extras'
import { TRACKED_BILLING_METRICS } from '@/modules/billing/billing-metrics.catalog'
import { syncCatalogMetrics } from '@/modules/billing/billing-metrics.sync'

type PlanModuleSeed = { module_key: OrgModuleKey; included: boolean; addon_price: string }
type PlanExtraSeed = { extra_key: BillingExtraKey; included: boolean; addon_price: string }
type PlanMetricAllowanceSeed = { metric_key: string; included_quantity: string; unit_price: string }

type BillingPlanSeed = {
  code: string
  name: string
  description: string
  base_price: string
  included_seats: number
  per_seat_price: string
  included_branches: number
  per_branch_price: string
  modules: PlanModuleSeed[]
  extras: PlanExtraSeed[]
  metric_allowances: PlanMetricAllowanceSeed[]
}

const BILLING_PLAN_SEEDS: BillingPlanSeed[] = [
  {
    code: 'inicial_mensual',
    name: 'Inicial',
    description: 'Facturación, contactos y catálogo para pymes que recién digitalizan su operación.',
    base_price: '24900.00',
    included_seats: 3,
    per_seat_price: '3500.00',
    included_branches: 1,
    per_branch_price: '8000.00',
    modules: ORG_MODULE_DEFS.map(d => ({
      module_key: d.key,
      included: d.tier === 'base',
      addon_price: d.tier === 'base' ? '0.00' : (
        d.key === 'inventory' ? '4500.00'
          : d.key === 'purchases' ? '4500.00'
            : d.key === 'accounting' ? '5500.00'
              : '6500.00'
      ),
    })),
    extras: [
      { extra_key: 'training', included: false, addon_price: '12000.00' },
      { extra_key: 'whatsapp_support', included: false, addon_price: '5000.00' },
      { extra_key: 'backup', included: false, addon_price: '3000.00' },
    ],
    metric_allowances: [
      { metric_key: 'afip_invoices_issued', included_quantity: '50.0000', unit_price: '15.00' },
      { metric_key: 'pos_tickets', included_quantity: '0.0000', unit_price: '5.00' },
      { metric_key: 'storage_gb', included_quantity: '0.0000', unit_price: '200.00' },
    ],
  },
  {
    code: 'profesional_mensual',
    name: 'Profesional',
    description: 'Operación completa multisucursal: inventario, compras, contabilidad y POS incluidos.',
    base_price: '59900.00',
    included_seats: 8,
    per_seat_price: '4500.00',
    included_branches: 3,
    per_branch_price: '6000.00',
    modules: ORG_MODULE_DEFS.map(d => ({
      module_key: d.key,
      included: true,
      addon_price: '0.00',
    })),
    extras: [
      { extra_key: 'training', included: false, addon_price: '8000.00' },
      { extra_key: 'whatsapp_support', included: true, addon_price: '0.00' },
      { extra_key: 'backup', included: true, addon_price: '0.00' },
    ],
    metric_allowances: [
      { metric_key: 'afip_invoices_issued', included_quantity: '500.0000', unit_price: '12.00' },
      { metric_key: 'pos_tickets', included_quantity: '1000.0000', unit_price: '4.00' },
      { metric_key: 'storage_gb', included_quantity: '5.0000', unit_price: '150.00' },
    ],
  },
]

export const SEED_PLAN_BY_ORG_SLUG: Record<string, string> = {
  demo: 'profesional_mensual',
  premium: 'inicial_mensual',
}

async function syncPlanModules(
  planId: string,
  modules: PlanModuleSeed[],
  actorId: string,
  t: Transaction,
) {
  await BillingPlanModule.destroy({ where: { plan_id: planId }, transaction: t })
  await BillingPlanModule.bulkCreate(
    modules.map(m => ({
      plan_id: planId,
      module_key: m.module_key,
      included: m.included,
      addon_price: m.addon_price,
      created_by: actorId,
      updated_by: actorId,
    })),
    { transaction: t },
  )
}

async function syncPlanExtras(
  planId: string,
  extras: PlanExtraSeed[],
  actorId: string,
  t: Transaction,
) {
  await BillingPlanExtra.destroy({ where: { plan_id: planId }, transaction: t })
  await BillingPlanExtra.bulkCreate(
    extras.map(e => ({
      plan_id: planId,
      extra_key: e.extra_key,
      included: e.included,
      addon_price: e.addon_price,
      created_by: actorId,
      updated_by: actorId,
    })),
    { transaction: t },
  )
}

async function syncPlanMetricAllowances(
  planId: string,
  allowances: PlanMetricAllowanceSeed[],
  actorId: string,
  t: Transaction,
) {
  await BillingPlanMetricAllowance.destroy({ where: { plan_id: planId }, transaction: t })
  if (allowances.length === 0) return
  await BillingPlanMetricAllowance.bulkCreate(
    allowances.map(a => ({
      plan_id: planId,
      metric_key: a.metric_key,
      included_quantity: a.included_quantity,
      unit_price: a.unit_price,
      created_by: actorId,
      updated_by: actorId,
    })),
    { transaction: t },
  )
}

export async function seedBillingPlans(actorId: string, t: Transaction): Promise<Map<string, BillingPlan>> {
  const byCode = new Map<string, BillingPlan>()

  for (const seed of BILLING_PLAN_SEEDS) {
    const { modules, extras, metric_allowances, ...fields } = seed
    const [plan] = await BillingPlan.findOrCreate({
      where: { code: seed.code },
      defaults: {
        ...fields,
        currency: 'ARS',
        interval: 'monthly',
        is_active: true,
        created_by: actorId,
        updated_by: actorId,
      },
      transaction: t,
    })

    await plan.update(
      { ...fields, currency: 'ARS', interval: 'monthly', is_active: true, updated_by: actorId },
      { transaction: t },
    )
    await syncPlanModules(plan.id, modules, actorId, t)
    await syncPlanExtras(plan.id, extras, actorId, t)
    await syncPlanMetricAllowances(plan.id, metric_allowances, actorId, t)
    byCode.set(seed.code, plan)
  }

  return byCode
}

export async function seedOrgSubscription(
  orgId: string,
  planCode: string,
  seats: number,
  actorId: string,
  plansByCode: Map<string, BillingPlan>,
  t: Transaction,
) {
  const plan = plansByCode.get(planCode)
  if (!plan) throw new Error(`Billing plan not found for seed: ${planCode}`)

  const existing = await OrgSubscription.findOne({
    where: { org_id: orgId, status: { [Op.ne]: 'cancelled' } },
    transaction: t,
  })
  if (existing) {
    await existing.update(
      { plan_id: plan.id, seats, status: 'active', updated_by: actorId },
      { transaction: t },
    )
    return existing
  }

  const now = new Date()
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))

  const sub = await OrgSubscription.create(
    {
      org_id: orgId,
      plan_id: plan.id,
      seats,
      billing_day: 1,
      status: 'active',
      started_at: now,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      created_by: actorId,
      updated_by: actorId,
    },
    { transaction: t },
  )

  const planExtras = await BillingPlanExtra.findAll({ where: { plan_id: plan.id }, transaction: t })
  const enabledExtras = planExtras.filter(e => e.included)
  if (enabledExtras.length > 0) {
    await SubscriptionExtra.bulkCreate(
      enabledExtras.map(e => ({
        subscription_id: sub.id,
        org_id: orgId,
        extra_key: e.extra_key,
        unit_price: '0.00',
        enabled: true,
        created_by: actorId,
        updated_by: actorId,
      })),
      { transaction: t },
    )
  }

  const planModules = await BillingPlanModule.findAll({ where: { plan_id: plan.id }, transaction: t })
  if (planModules.length > 0) {
    await SubscriptionAddon.destroy({ where: { subscription_id: sub.id }, transaction: t })
    await SubscriptionAddon.bulkCreate(
      planModules.map(m => ({
        subscription_id: sub.id,
        org_id: orgId,
        module_key: m.module_key,
        unit_price: m.included ? '0.00' : m.addon_price,
        enabled: m.included,
        created_by: actorId,
        updated_by: actorId,
      })),
      { transaction: t },
    )

    const { syncSubscriptionContractToOrg } = await import('@/modules/billing/subscription-contract.service')
    await syncSubscriptionContractToOrg(
      orgId,
      plan.id,
      planModules.map(m => ({
        module_key: m.module_key,
        unit_price: m.included ? '0.00' : m.addon_price,
        enabled: m.included,
      })),
      t,
    )
  }

  return sub
}

const PLATFORM_BILLER_SEED = {
  biller_legal_name:          'Andiko S.A.',
  biller_cuit:                '30-71234567-8',
  biller_iva_condition:       'responsable_inscripto',
  biller_fiscal_address:      'Av. Corrientes 1234, Piso 5, C1043AAZ, Ciudad Autónoma de Buenos Aires',
  biller_gross_income:        '901-123456-7',
  biller_activity_start_date: '2019-06-01',
  biller_email:               'facturacion@andiko.app',
  biller_phone:               '+54 11 4000-1234',
} as const

/** Dummy platform issuer ("emisor") for sys-admin billing → /sys-admin/billing/emisor */
export async function seedPlatformBillerSettings(t: Transaction) {
  const [row] = await PlatformSetting.findOrCreate({
    where: { singleton: true },
    defaults: { singleton: true },
    transaction: t,
  })
  await row.update({ ...PLATFORM_BILLER_SEED }, { transaction: t })
  return row
}

export function seedBillerSummaryLine(): string {
  return `  Emisor: ${PLATFORM_BILLER_SEED.biller_legal_name} · CUIT ${PLATFORM_BILLER_SEED.biller_cuit}`
}

export function seedPlanSummaryLines(): string[] {
  return BILLING_PLAN_SEEDS.map(p => {
    const includedModules = p.modules.filter(m => m.included).length
    const includedExtras = p.extras.filter(e => e.included).map(e =>
      BILLING_EXTRA_DEFS.find(d => d.key === e.extra_key)?.label ?? e.extra_key,
    )
    const extrasLabel = includedExtras.length > 0 ? ` · extras: ${includedExtras.join(', ')}` : ''
    return `  ${p.name} (${p.code}): $${p.base_price}/mes · ${p.included_seats} usuarios · ${p.included_branches} sucursal(es) · ${includedModules} módulos${extrasLabel}`
  })
}

export async function seedBillingMetrics(actorId: string, t: Transaction) {
  await syncCatalogMetrics(actorId, t)
}

export function seedMetricsSummaryLine(): string {
  return `  Métricas: ${TRACKED_BILLING_METRICS.map(m => m.key).join(', ')}`
}
