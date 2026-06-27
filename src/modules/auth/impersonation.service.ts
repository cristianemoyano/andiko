import 'server-only'
import { Op } from 'sequelize'
import User from '@/modules/auth/user.model'
import Organization from '@/modules/auth/organization.model'
import type { UserRole } from '@/types/roles'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(v: string): boolean {
  return UUID_RE.test(v.trim())
}

export async function loadUserForImpersonation(id: string) {
  if (!isUuid(id)) return null
  return User.findOne({
    where: { id: id.trim(), is_active: true },
    attributes: ['id', 'email', 'name', 'role', 'org_id', 'branch_id', 'org_role_id'],
  })
}

/** Sys-admin user picker: excludes other sys-admins and inactive accounts. */
export async function searchUsersForSysAdmin(query: string, limit: number) {
  const q = query.trim()
  if (q.length < 2) return []

  const cap = Math.min(Math.max(limit, 1), 50)

  const rows = await User.findAll({
    where: {
      [Op.and]: [
        {
          [Op.or]: [
            { email: { [Op.iLike]: `%${q}%` } },
            { name: { [Op.iLike]: `%${q}%` } },
          ],
        },
        { is_active: true },
        { role: { [Op.ne]: 'sys-admin' as UserRole } },
      ],
    },
    attributes: ['id', 'email', 'name', 'role', 'org_id', 'branch_id'],
    limit: cap,
    order: [['email', 'ASC']],
  })

  const orgIds = [...new Set(rows.map(u => u.org_id).filter((id): id is string => !!id))]
  const orgs = orgIds.length
    ? await Organization.findAll({ where: { id: orgIds }, attributes: ['id', 'name'] })
    : []
  const orgNameById = new Map(orgs.map(o => [o.id, o.name]))

  return rows.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as UserRole,
    org_id: u.org_id,
    org_name: u.org_id ? orgNameById.get(u.org_id) ?? null : null,
    branch_id: u.branch_id,
  }))
}
