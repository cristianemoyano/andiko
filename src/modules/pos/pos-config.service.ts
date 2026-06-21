import 'server-only'
import OrganizationSetting from '@/modules/auth/organization-setting.model'
import Organization from '@/modules/auth/organization.model'
import { DEFAULT_ENABLED_MODULES } from '@/modules/auth/organization-modules'
import { DEFAULT_BALANZA_CONFIG, type BalanzaBarcodeConfig } from './balanza-barcode'
import type { PosConfig } from './pos-config.schema'
import logger from '@/lib/logger'

/** POS config for an org, falling back to sane defaults when unset. */
export async function getPosConfig(orgId: string): Promise<Required<PosConfig>> {
  const row = await OrganizationSetting.findOne({
    where: { org_id: orgId },
    attributes: ['pos_config'],
  })
  const cfg = row?.pos_config ?? {}
  return {
    balanza: cfg.balanza ?? { ...DEFAULT_BALANZA_CONFIG },
  }
}

export async function getBalanzaConfig(orgId: string): Promise<BalanzaBarcodeConfig> {
  return (await getPosConfig(orgId)).balanza
}

export async function updateBalanzaConfig(
  orgId: string,
  balanza: BalanzaBarcodeConfig,
): Promise<Required<PosConfig>> {
  const org = await Organization.findByPk(orgId)
  if (!org) throw new Error('ORG_NOT_FOUND')

  const existing = await OrganizationSetting.findOne({
    where: { org_id: orgId },
    attributes: ['id', 'pos_config'],
  })

  if (existing) {
    const nextPosConfig: PosConfig = { ...(existing.pos_config ?? {}), balanza }
    await existing.update({ pos_config: nextPosConfig })
  } else {
    await OrganizationSetting.create({
      org_id: orgId,
      enabled_modules: [...DEFAULT_ENABLED_MODULES],
      enabled_features: {},
      pos_config: { balanza },
    })
  }

  logger.info({ orgId }, 'balanza config updated')
  return getPosConfig(orgId)
}
