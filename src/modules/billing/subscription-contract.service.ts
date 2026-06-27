import 'server-only'
import type { Transaction } from 'sequelize'
import BillingPlanModule from './billing-plan-module.model'
import { updateOrganizationSettings } from '@/modules/auth/organization-settings.service'
import type { OrgModuleKey } from '@/modules/auth/organization-modules'
import type { SubscriptionAddonInput } from './subscription.schema'

/** Derive enabled ERP modules from plan included modules + paid add-ons. */
export async function deriveModulesFromPlan(
  planId: string,
  addons: SubscriptionAddonInput[],
  t?: Transaction,
): Promise<OrgModuleKey[]> {
  const planModules = await BillingPlanModule.findAll({ where: { plan_id: planId }, transaction: t })
  const enabled = new Set<OrgModuleKey>()

  for (const pm of planModules) {
    if (pm.included) enabled.add(pm.module_key)
  }

  for (const addon of addons) {
    if (addon.enabled) enabled.add(addon.module_key as OrgModuleKey)
  }

  return [...enabled]
}

/** Merge plan-included modules with user-selected paid add-ons for subscription create. */
export async function resolveAddonsForCreate(
  planId: string,
  userAddons: SubscriptionAddonInput[],
  t: Transaction,
): Promise<SubscriptionAddonInput[]> {
  const planModules = await BillingPlanModule.findAll({ where: { plan_id: planId }, transaction: t })
  const byKey = new Map<string, SubscriptionAddonInput>()

  for (const pm of planModules) {
    byKey.set(pm.module_key, {
      module_key: pm.module_key,
      unit_price: pm.included ? '0.00' : pm.addon_price,
      enabled: pm.included,
    })
  }

  for (const addon of userAddons) {
    byKey.set(addon.module_key, addon)
  }

  return [...byKey.values()]
}

export async function syncSubscriptionContractToOrg(
  orgId: string,
  planId: string,
  addons: SubscriptionAddonInput[],
  t: Transaction,
): Promise<void> {
  const modules = await deriveModulesFromPlan(planId, addons, t)
  await updateOrganizationSettings(orgId, { enabled_modules: modules })
}
