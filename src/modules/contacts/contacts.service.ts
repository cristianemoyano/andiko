import 'server-only'
import { Op } from 'sequelize'
import Contact from './contact.model'
import type { ContactInput, ContactUpdateInput, ContactQuery } from './contact.schema'
import { formatCuit } from './contact.utils'
import { paginate, toPaginated } from '@/lib/pagination'
import logger from '@/lib/logger'

export async function listContacts(query: ContactQuery) {
  const { page, limit, search, type } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = {}
  if (type) where.type = type
  if (search) {
    where[Op.or as unknown as string] = [
      { legal_name: { [Op.iLike]: `%${search}%` } },
      { trade_name: { [Op.iLike]: `%${search}%` } },
      { cuit: { [Op.iLike]: `%${search}%` } },
    ]
  }

  const { rows, count } = await Contact.findAndCountAll({
    where,
    limit,
    offset,
    order: [['legal_name', 'ASC']],
    attributes: ['id', 'type', 'legal_name', 'trade_name', 'cuit', 'iva_condition', 'email', 'phone', 'is_active'],
  })

  return toPaginated(rows, count, page, limit)
}

export async function getContact(id: string) {
  const contact = await Contact.findByPk(id)
  if (!contact) throw new Error('CONTACT_NOT_FOUND')
  return contact
}

export async function createContact(input: ContactInput, actorId: string) {
  const contact = await Contact.create({
    ...input,
    cuit: input.cuit ? formatCuit(input.cuit) : null,
    created_by: actorId,
    updated_by: actorId,
  })
  logger.info({ contactId: contact.id, actorId }, 'contact created')
  return contact
}

export async function updateContact(id: string, input: ContactUpdateInput, actorId: string) {
  const contact = await getContact(id)
  await contact.update({
    ...input,
    ...(input.cuit ? { cuit: formatCuit(input.cuit) } : {}),
    updated_by: actorId,
  })
  logger.info({ contactId: id, actorId }, 'contact updated')
  return contact
}

export async function deleteContact(id: string, actorId: string) {
  const contact = await getContact(id)
  await contact.update({ deleted_by: actorId })
  await contact.destroy()
  logger.info({ contactId: id, actorId }, 'contact soft-deleted')
}
