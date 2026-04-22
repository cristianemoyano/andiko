import 'server-only'
import { Op } from 'sequelize'
import sequelize from '@/lib/db'
import Organization from '@/modules/auth/organization.model'
import Branch from '@/modules/auth/branch.model'
import { slugifyText } from '@/lib/slug'
import type {
  OrganizationCreateInput,
  OrganizationUpdateInput,
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
  const org = await Organization.create({
    name: input.name.trim(),
    slug,
    is_active: true,
  })
  return org
}

export async function getOrganizationWithBranches(id: string) {
  const org = await Organization.findByPk(id)
  if (!org) throw new Error('ORG_NOT_FOUND')
  const branches = await Branch.findAll({
    where: { org_id: id },
    order: [['branch_code', 'ASC'], ['name', 'ASC']],
    attributes: ['id', 'org_id', 'branch_code', 'name', 'address', 'is_active', 'created_at', 'updated_at'],
  })
  return { organization: org, branches }
}

export async function updateOrganization(id: string, input: OrganizationUpdateInput) {
  const org = await Organization.findByPk(id)
  if (!org) throw new Error('ORG_NOT_FOUND')

  const next: Partial<{ name: string; slug: string; is_active: boolean }> = {}
  if (input.name !== undefined) next.name = input.name.trim()
  if (input.is_active !== undefined) next.is_active = input.is_active
  if (input.slug !== undefined) {
    const s = input.slug.trim().toLowerCase()
    if (s !== org.slug) {
      const taken = await Organization.findOne({
        where: { slug: s, id: { [Op.ne]: id } },
        paranoid: true,
      })
      if (taken) throw new Error('ORG_SLUG_TAKEN')
      next.slug = s
    }
  }

  await org.update(next)
  return org.reload()
}

export async function deleteOrganization(id: string) {
  const org = await Organization.findByPk(id)
  if (!org) throw new Error('ORG_NOT_FOUND')
  await org.destroy()
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
    return Branch.create(
      {
        org_id: orgId,
        branch_code,
        name: input.name.trim(),
        address: input.address ?? null,
        is_active: true,
      },
      { transaction: t },
    )
  })
}

export async function updateBranch(id: string, input: BranchUpdateInput) {
  const branch = await Branch.findByPk(id)
  if (!branch) throw new Error('BRANCH_NOT_FOUND')
  const next: Partial<{ name: string; address: string | null; is_active: boolean }> = {}
  if (input.name !== undefined) next.name = input.name.trim()
  if (input.address !== undefined) next.address = input.address
  if (input.is_active !== undefined) next.is_active = input.is_active
  await branch.update(next)
  return branch.reload()
}

export async function deleteBranch(id: string) {
  const branch = await Branch.findByPk(id)
  if (!branch) throw new Error('BRANCH_NOT_FOUND')
  await branch.destroy()
}
