import 'server-only'
import { cache } from 'react'
import OrganizationSetting from './organization-setting.model'
import Organization from './organization.model'
import {
  DEFAULT_ENABLED_MODULES,
  PERMISSION_RESOURCE_TO_MODULE,
  type OrgModuleKey,
} from './organization-modules'

export interface EffectiveOrganizationSettings {
  org_id: string
  enabled_modules: OrgModuleKey[]
  enabled_features: Record<string, boolean>
  /** true cuando la org no tiene fila propia y aplican los defaults */
  is_default: boolean
}

async function loadEffectiveSettings(orgId: string): Promise<EffectiveOrganizationSettings> {
  const row = await OrganizationSetting.findOne({
    where: { org_id: orgId },
    attributes: ['enabled_modules', 'enabled_features'],
  })
  return {
    org_id: orgId,
    enabled_modules: row?.enabled_modules ?? [...DEFAULT_ENABLED_MODULES],
    enabled_features: row?.enabled_features ?? {},
    is_default: !row || row.enabled_modules === null,
  }
}

/** Deduplicado por request via React cache() — seguro para llamar desde layout y rutas. */
export const getEffectiveOrganizationSettings = cache(loadEffectiveSettings)

export async function isModuleEnabled(orgId: string, module: OrgModuleKey): Promise<boolean> {
  const settings = await getEffectiveOrganizationSettings(orgId)
  return settings.enabled_modules.includes(module)
}

/** Módulo que gobierna un permiso (`sales:read` → `sales`), o null si el recurso no está modulado. */
export function moduleForPermission(permission: string): OrgModuleKey | null {
  const resource = permission.split(':')[0]
  return PERMISSION_RESOURCE_TO_MODULE[resource] ?? null
}

export async function updateOrganizationSettings(
  orgId: string,
  input: { enabled_modules?: OrgModuleKey[]; enabled_features?: Record<string, boolean> },
): Promise<EffectiveOrganizationSettings> {
  const org = await Organization.findByPk(orgId)
  if (!org) throw new Error('ORG_NOT_FOUND')

  const existing = await OrganizationSetting.findOne({
    where: { org_id: orgId },
    attributes: ['id', 'enabled_modules', 'enabled_features'],
  })
  if (existing) {
    const next: Partial<{ enabled_modules: OrgModuleKey[]; enabled_features: Record<string, boolean> }> = {}
    if (input.enabled_modules !== undefined) next.enabled_modules = input.enabled_modules
    if (input.enabled_features !== undefined) next.enabled_features = input.enabled_features
    await existing.update(next)
  } else {
    await OrganizationSetting.create({
      org_id: orgId,
      enabled_modules: input.enabled_modules ?? [...DEFAULT_ENABLED_MODULES],
      enabled_features: input.enabled_features ?? {},
    })
  }
  return loadEffectiveSettings(orgId)
}
