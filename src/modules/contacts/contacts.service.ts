import 'server-only'
import { Op } from 'sequelize'
import Contact from './contact.model'
import type { ContactInput, ContactUpdateInput, ContactQuery } from './contact.schema'
import { formatCuit } from './contact.utils'
import logger from '@/lib/logger'

export async function listContacts(query: ContactQuery) {
  const { page, limit, search, type } = query
  const offset = (page - 1) * limit

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

  return { data: rows, total: count, page, limit }
}

export async function getContact(id: string) {
  const contact = await Contact.findByPk(id)
  if (!contact) throw new Error('CONTACT_NOT_FOUND')
  return contact
}

export async function createContact(input: ContactInput) {
  const data = {
    ...input,
    cuit: input.cuit ? formatCuit(input.cuit) : null,
  }

  const contact = await Contact.create(data)
  logger.info({ contactId: contact.id }, 'contact created')
  return contact
}

export async function updateContact(id: string, input: ContactUpdateInput) {
  const contact = await getContact(id)

  await contact.update({
    ...input,
    ...(input.cuit ? { cuit: formatCuit(input.cuit) } : {}),
  })

  logger.info({ contactId: id }, 'contact updated')
  return contact
}

export async function deleteContact(id: string) {
  const contact = await getContact(id)
  await contact.destroy()
  logger.info({ contactId: id }, 'contact soft-deleted')
}
