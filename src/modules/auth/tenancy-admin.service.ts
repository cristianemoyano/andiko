import 'server-only'
import { Op } from 'sequelize'
import sequelize from '@/lib/db'
import Organization, { type OrgIvaCondition } from '@/modules/auth/organization.model'
import Branch from '@/modules/auth/branch.model'
import { slugifyText } from '@/lib/slug'
import { formatAddress } from '@/lib/format-address'
import { seedDefaultChartOfAccounts } from '@/modules/accounting/chart-seed'
import { seedDefaultOrgRoles } from '@/modules/auth/org-roles.service'
import { updateOrganizationSettings } from '@/modules/auth/organization-settings.service'
import { getDefaultModulesForPlan } from '@/modules/auth/organization-modules'
import type {
  OrganizationCreateInput,
  OrganizationUpdateInput,
  OrganizationFiscalUpdateInput,
  BranchCreateInput,
  BranchUpdateInput,
} from '@/modules/auth/tenancy-admin.schema'

export async function listOrganizationsAdmin() {
  const orgs = await Organization.findAll({
    order: [['name', 'ASC']],
    attributes: ['id', 'name', 'slug', 'is_active', 'created_at', 'updated_at'],
  })
  const ids = orgs.map(o => o.id)
  if (ids.length === 0) return []

  const branchRows = await Branch.findAll({
    attributes: ['org_id'],
    where: { org_id: { [Op.in]: ids } },
  })
  const countMap = new Map<string, number>()
  for (const id of ids) countMap.set(id, 0)
  for (const b of branchRows) {
    countMap.set(b.org_id, (countMap.get(b.org_id) ?? 0) + 1)
  }

  return orgs.map(o => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    is_active: o.is_active,
    created_at: o.created_at,
    updated_at: o.updated_at,
    branch_count: countMap.get(o.id) ?? 0,
  }))
}

/** Unique slug: optional base from user; otherwise from name. */
async function allocateSlug(desiredBase: string): Promise<string> {
  let base = desiredBase.trim().slice(0, 100)
  if (!base) base = 'org'
  let slug = base
  for (let n = 0; n < 500; n += 1) {
    const exists = await Organization.findOne({ where: { slug }, paranoid: true })
    if (!exists) return slug
    const suffix = `-${n + 1}`
    slug = `${base.slice(0, Math.max(0, 100 - suffix.length))}${suffix}`
  }
  throw new Error('ORG_SLUG_EXHAUSTED')
}

export async function createOrganization(input: OrganizationCreateInput) {
  const baseSlug = input.slug?.trim()
    ? slugifyText(input.slug.trim())
    : slugifyText(input.name)
  const slug = await allocateSlug(baseSlug)
  return sequelize.transaction(async (t) => {
    const org = await Organization.create(
      {
        name: input.name.trim(),
        slug,
        is_active: true,
        legal_name: input.legal_name?.trim() ?? null,
        cuit: input.cuit ?? null,
        iva_condition: input.iva_condition ?? null,
        fiscal_address: input.fiscal_address?.trim() ?? null,
      },
      { transaction: t },
    )
    await seedDefaultChartOfAccounts(org.id, t)
    await seedDefaultOrgRoles(org.id, t)
    // Fija explícitamente los módulos habilitados en creación, en vez de dejar que
    // el fallback implícito de organization-settings.service.ts (is_default) decida.
    await updateOrganizationSettings(org.id, { enabled_modules: getDefaultModulesForPlan('full') }, t)
    return org
  })
}

export async function getOrganizationWithBranches(id: string) {
  const org = await Organization.findByPk(id)
  if (!org) throw new Error('ORG_NOT_FOUND')
  const branches = await Branch.findAll({
    where: { org_id: id },
    order: [['branch_code', 'ASC'], ['name', 'ASC']],
    attributes: [
      'id', 'org_id', 'branch_code', 'name', 'address',
      'street', 'number', 'floor', 'apartment', 'city', 'province', 'postal_code', 'country',
      'is_active', 'created_at', 'updated_at',
    ],
  })
  return { organization: org, branches }
}

export async function updateOrganization(id: string, input: OrganizationUpdateInput) {
  const org = await Organization.findByPk(id)
  if (!org) throw new Error('ORG_NOT_FOUND')

  const next: Partial<{
    name: string
    is_active: boolean
    legal_name: string | null
    cuit: string | null
    iva_condition: OrgIvaCondition | null
    fiscal_address: string | null
  }> = {}
  if (input.name !== undefined) next.name = input.name.trim()
  if (input.is_active !== undefined) next.is_active = input.is_active
  if (input.legal_name !== undefined) next.legal_name = input.legal_name?.trim() || null
  if (input.cuit !== undefined) next.cuit = input.cuit
  if (input.iva_condition !== undefined) next.iva_condition = input.iva_condition
  if (input.fiscal_address !== undefined) next.fiscal_address = input.fiscal_address?.trim() || null

  await org.update(next)
  return org.reload()
}

export async function updateOrganizationFiscal(orgId: string, input: OrganizationFiscalUpdateInput) {
  const org = await Organization.findByPk(orgId)
  if (!org) throw new Error('ORG_NOT_FOUND')

  const next: Partial<{
    legal_name: string | null
    cuit: string | null
    iva_condition: OrgIvaCondition | null
    fiscal_address: string | null
  }> = {}

  if (input.legal_name !== undefined) next.legal_name = input.legal_name?.trim() || null
  if (input.cuit !== undefined) next.cuit = input.cuit
  if (input.iva_condition !== undefined) next.iva_condition = input.iva_condition
  if (input.fiscal_address !== undefined) next.fiscal_address = input.fiscal_address?.trim() || null

  await org.update(next)
  return org.reload()
}

export async function getOrganizationDetailForTenant(orgId: string) {
  const { organization, branches } = await getOrganizationWithBranches(orgId)
  return {
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      is_active: organization.is_active,
      legal_name: organization.legal_name,
      cuit: organization.cuit,
      iva_condition: organization.iva_condition,
      fiscal_address: organization.fiscal_address,
      created_at: organization.created_at.toISOString(),
      updated_at: organization.updated_at.toISOString(),
    },
    branches: branches.map(b => ({
      id: b.id,
      org_id: b.org_id,
      branch_code: b.branch_code,
      name: b.name,
      address: b.address,
      street: b.street,
      number: b.number,
      floor: b.floor,
      apartment: b.apartment,
      city: b.city,
      province: b.province,
      postal_code: b.postal_code,
      country: b.country,
      is_active: b.is_active,
    })),
  }
}

export async function assertBranchBelongsToOrg(orgId: string, branchId: string) {
  const branch = await Branch.findOne({ where: { id: branchId, org_id: orgId }, paranoid: true })
  if (!branch) throw new Error('BRANCH_NOT_IN_ORG')
  return branch
}

export async function countActiveBranches(orgId: string) {
  return Branch.count({ where: { org_id: orgId, is_active: true } })
}

export async function deleteOrganization(id: string) {
  const org = await Organization.findByPk(id)
  if (!org) throw new Error('ORG_NOT_FOUND')
  await org.destroy()
}

const ADDRESS_KEYS = ['street', 'number', 'floor', 'apartment', 'city', 'province', 'postal_code', 'country'] as const
type BranchAddressColumns = { [K in (typeof ADDRESS_KEYS)[number]]: string | null }
type AddressInput = Partial<Record<(typeof ADDRESS_KEYS)[number], string | null | undefined>>

/** `undefined` keeps the current value; `''`/whitespace clears it to null. */
function normField(value: string | null | undefined, fallback: string | null): string | null {
  if (value === undefined) return fallback
  if (value === null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Resolve the 8 structured address columns, merging input over the current branch. */
function pickAddressFields(input: AddressInput, current?: Branch): BranchAddressColumns {
  const out = {} as BranchAddressColumns
  for (const key of ADDRESS_KEYS) {
    out[key] = normField(input[key], (current?.[key] ?? null) as string | null)
  }
  return out
}

export async function createBranch(orgId: string, input: BranchCreateInput) {
  const org = await Organization.findByPk(orgId)
  if (!org) throw new Error('ORG_NOT_FOUND')
  return sequelize.transaction(async (t) => {
    const maxRaw = await Branch.max('branch_code', {
      where: { org_id: orgId },
      transaction: t,
    })
    const maxCode = typeof maxRaw === 'number' ? maxRaw : 0
    const branch_code = maxCode + 1
    if (branch_code > 9999) throw new Error('BRANCH_CODE_EXHAUSTED')
    const structured = pickAddressFields(input)
    return Branch.create(
      {
        org_id: orgId,
        branch_code,
        name: input.name.trim(),
        ...structured,
        // Derive the legacy one-line address from structured fields, falling
        // back to any free-text address provided by legacy clients.
        address: formatAddress(structured) || input.address?.trim() || null,
        is_active: true,
      },
      { transaction: t },
    )
  })
}

export async function updateBranch(id: string, input: BranchUpdateInput) {
  const branch = await Branch.findByPk(id)
  if (!branch) throw new Error('BRANCH_NOT_FOUND')

  const next: Partial<BranchAddressColumns & { name: string; address: string | null; is_active: boolean }> = {}
  if (input.name !== undefined) next.name = input.name.trim()
  if (input.is_active !== undefined) next.is_active = input.is_active

  const touchesAddress = ADDRESS_KEYS.some(k => input[k] !== undefined) || input.address !== undefined
  if (touchesAddress) {
    const structured = pickAddressFields(input, branch)
    Object.assign(next, structured)
    // Re-derive from the structured fields; fall back to a legacy free-text
    // `address` only. Do NOT fall back to the previous value, otherwise
    // clearing every field would leave the derived address stale.
    next.address = formatAddress(structured) || input.address?.trim() || null
  }

  await branch.update(next)
  return branch.reload()
}

export async function deleteBranch(id: string) {
  const branch = await Branch.findByPk(id)
  if (!branch) throw new Error('BRANCH_NOT_FOUND')
  await branch.destroy()
}
