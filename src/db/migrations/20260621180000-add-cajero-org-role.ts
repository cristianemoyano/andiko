import type { Migration } from '../../lib/migrations'
import { ensureOrgRoleTemplates } from '../../modules/auth/org-roles-seed'
import Organization from '../../modules/auth/organization.model'

export const up: Migration = async () => {
  const orgs = await Organization.findAll({ attributes: ['id'], paranoid: true })
  for (const org of orgs) {
    await ensureOrgRoleTemplates(org.id, ['Cajero'])
  }
}

export const down: Migration = async () => {
  // Org role data is not rolled back automatically.
}
