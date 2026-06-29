import 'server-only'
import { Op } from 'sequelize'
import User from '@/modules/auth/user.model'
import OrgRole from '@/modules/auth/org-role.model'
import { listActiveBranchesForOrg } from '@/modules/auth/branches.service'
import { formatUserDisplayName } from '@/modules/auth/user.utils'

export type SharePrincipalOption = {
  id: string
  label: string
}

export type SharePrincipalOptions = {
  users: SharePrincipalOption[]
  org_roles: SharePrincipalOption[]
  branches: SharePrincipalOption[]
}

/** Org-scoped pickers for the file-sharing dialog (users, custom roles, branches). */
export async function listSharePrincipalOptions(orgId: string): Promise<SharePrincipalOptions> {
  const [users, roles, branches] = await Promise.all([
    User.findAll({
      where: { org_id: orgId, is_active: true, role: { [Op.ne]: 'sys-admin' } },
      attributes: ['id', 'email', 'name', 'first_name', 'last_name'],
      order: [['email', 'ASC']],
    }),
    OrgRole.findAll({
      where: { org_id: orgId },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    }),
    listActiveBranchesForOrg(orgId),
  ])

  return {
    users: users.map((u) => {
      const display = formatUserDisplayName(u.first_name, u.last_name) || u.name?.trim() || u.email
      return { id: u.id, label: display === u.email ? u.email : `${display} (${u.email})` }
    }),
    org_roles: roles.map((r) => ({ id: r.id, label: r.name })),
    branches: branches.map((b) => ({
      id: b.id,
      label: b.branch_code ? `${b.name} (${b.branch_code})` : b.name,
    })),
  }
}
