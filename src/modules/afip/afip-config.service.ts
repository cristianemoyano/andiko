import 'server-only'
import { env } from '@/config/env'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { whereAllowedBranchRecords, type TenantContext } from '@/lib/tenancy'
import Branch from '@/modules/auth/branch.model'
import Organization, { type OrgIvaCondition, type OnboardingData } from '@/modules/auth/organization.model'
import { getCredentialStatus, type CredentialStatus } from './afip-credentials.service'
import type { AfipConfigInput, AfipOrgFiscalInput } from './afip.schema'

export type AfipConfigView = {
  environment: string
  certificateConfigured: boolean
  credentials: CredentialStatus[]
  organization: { cuit: string | null; iva_condition: string | null; legal_name: string | null; fiscal_address: string | null }
  branches: { id: string; name: string; branch_code: number; punto_venta: number | null }[]
}

/** Returns AFIP configuration status. Never exposes certificate contents/secrets. */
export async function getAfipConfig(ctx: TenantContext): Promise<AfipConfigView> {
  const [org, branches, credentials] = await Promise.all([
    Organization.findByPk(ctx.orgId),
    Branch.findAll({
      where: whereAllowedBranchRecords(ctx, { is_active: true }),
      attributes: ['id', 'name', 'branch_code', 'punto_venta'],
      order: [['branch_code', 'ASC']],
    }),
    getCredentialStatus(ctx),
  ])

  const certificateConfigured =
    env.AFIP_MODE === 'stub' || credentials.some((c) => c.environment === env.AFIP_MODE)

  return {
    environment: env.AFIP_MODE,
    certificateConfigured,
    credentials,
    organization: {
      cuit: org?.cuit ?? null,
      iva_condition: org?.iva_condition ?? null,
      legal_name: org?.legal_name ?? null,
      fiscal_address: org?.fiscal_address ?? null,
    },
    branches: branches.map((b) => ({
      id: b.id,
      name: b.name,
      branch_code: b.branch_code,
      punto_venta: b.punto_venta,
    })),
  }
}

/** Updates the tenant organization's fiscal fields required for AFIP emission. */
export async function updateOrgFiscal(input: AfipOrgFiscalInput, ctx: TenantContext) {
  const org = await Organization.findByPk(ctx.orgId)
  if (!org) throw new Error('AFIP_ORG_NOT_FOUND')

  await org.update({
    legal_name: input.legal_name.trim(),
    cuit: input.cuit,
    iva_condition: input.iva_condition,
    fiscal_address: input.fiscal_address?.trim() || null,
  })

  logger.info({ orgId: ctx.orgId, iva_condition: input.iva_condition }, 'org fiscal data updated for AFIP')
  return org.reload()
}

/** Maps onboarding wizard IVA values to organization.iva_condition. */
export function mapOnboardingIvaCondition(value: string | undefined): OrgIvaCondition | null {
  switch (value) {
    case 'responsable_inscripto': return 'responsable_inscripto'
    case 'monotributo': return 'monotributista'
    case 'exento': return 'exento'
    case 'no_alcanzado': return 'no_responsable'
    default: return null
  }
}

/** Builds fiscal_address from onboarding company step fields. */
export function fiscalAddressFromOnboarding(company: NonNullable<OnboardingData['company']>): string | null {
  const parts = [company.calle, company.ciudad, company.provincia, company.cp].map(s => s?.trim()).filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}

/** Persists onboarding company fields onto the organization fiscal columns. */
export function fiscalFieldsFromOnboarding(data: OnboardingData): {
  legal_name: string | null
  cuit: string | null
  iva_condition: OrgIvaCondition | null
  fiscal_address: string | null
} {
  const company = data.company
  if (!company) {
    return { legal_name: null, cuit: null, iva_condition: null, fiscal_address: null }
  }
  return {
    legal_name: company.razonSocial?.trim() || null,
    cuit: company.cuit?.trim() || null,
    iva_condition: mapOnboardingIvaCondition(company.condicionIVA),
    fiscal_address: fiscalAddressFromOnboarding(company),
  }
}

/** Sets AFIP puntos de venta for multiple branches atomically. */
export async function setBranchesPuntoVenta(input: AfipConfigInput, ctx: TenantContext) {
  return sequelize.transaction(async (t) => {
    const results: { id: string; punto_venta: number | null }[] = []

    for (const { branch_id, punto_venta } of input.branches) {
      const branch = await Branch.findOne({
        where: whereAllowedBranchRecords(ctx, { id: branch_id }),
        transaction: t,
      })
      if (!branch) throw new Error('BRANCH_NOT_FOUND')

      await branch.update({ punto_venta }, { transaction: t })
      await branch.reload({ transaction: t })
      results.push({ id: branch.id, punto_venta: branch.punto_venta })
    }

    logger.info({ orgId: ctx.orgId, branchCount: results.length }, 'afip puntos de venta updated')
    return results
  })
}
