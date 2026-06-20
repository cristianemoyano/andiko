import 'server-only'
import { env } from '@/config/env'
import logger from '@/lib/logger'
import { whereAllowedBranches, type TenantContext } from '@/lib/tenancy'
import Branch from '@/modules/auth/branch.model'
import Organization from '@/modules/auth/organization.model'

export type AfipConfigView = {
  environment: string
  certificateConfigured: boolean
  organization: { cuit: string | null; iva_condition: string | null; legal_name: string | null }
  branches: { id: string; name: string; branch_code: number; punto_venta: number | null }[]
}

/** Returns AFIP configuration status. Never exposes certificate contents/secrets. */
export async function getAfipConfig(ctx: TenantContext): Promise<AfipConfigView> {
  const [org, branches] = await Promise.all([
    Organization.findByPk(ctx.orgId),
    Branch.findAll({
      where: whereAllowedBranches(ctx, { is_active: true }),
      attributes: ['id', 'name', 'branch_code', 'punto_venta'],
      order: [['branch_code', 'ASC']],
    }),
  ])

  return {
    environment: env.AFIP_MODE,
    certificateConfigured: Boolean(env.AFIP_CUIT && env.AFIP_CERT_PATH && env.AFIP_KEY_PATH),
    organization: {
      cuit: org?.cuit ?? null,
      iva_condition: org?.iva_condition ?? null,
      legal_name: org?.legal_name ?? null,
    },
    branches: branches.map((b) => ({
      id: b.id,
      name: b.name,
      branch_code: b.branch_code,
      punto_venta: b.punto_venta,
    })),
  }
}

/** Sets the AFIP punto de venta for a branch (scoped to the tenant's allowed branches). */
export async function setBranchPuntoVenta(branchId: string, puntoVenta: number, ctx: TenantContext) {
  const branch = await Branch.findOne({ where: whereAllowedBranches(ctx, { id: branchId }) })
  if (!branch) throw new Error('BRANCH_NOT_FOUND')

  await branch.update({ punto_venta: puntoVenta })
  logger.info({ branchId, puntoVenta, orgId: ctx.orgId }, 'afip punto de venta updated')
  return branch.reload()
}
