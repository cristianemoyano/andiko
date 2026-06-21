import type { Migration } from '../../lib/migrations'
import { seedDefaultOrgRoles } from '../../modules/auth/org-roles-seed'
import Organization from '../../modules/auth/organization.model'

export const up: Migration = async () => {
  const orgs = await Organization.findAll({ attributes: ['id'], paranoid: true })
  for (const org of orgs) {
    await seedDefaultOrgRoles(org.id)
  }
}

export const down: Migration = async () => {
  // Default templates are org data — no automatic rollback.
}
