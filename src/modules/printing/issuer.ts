import 'server-only'
import Organization from '@/modules/auth/organization.model'

export async function getIssuerName(orgId: string): Promise<string> {
  const org = await Organization.findByPk(orgId, { attributes: ['name'] })
  return org?.name ?? 'Organización'
}
