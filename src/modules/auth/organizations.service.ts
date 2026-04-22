import 'server-only'
import Organization from './organization.model'

export async function listActiveOrganizations() {
  return Organization.findAll({
    attributes: ['id', 'name', 'slug'],
    where: { is_active: true },
    order: [['name', 'ASC']],
  })
}
