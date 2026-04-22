import 'server-only'
import { Op } from 'sequelize'
import Contact from './contact.model'
import type { ContactInput, ContactUpdateInput, ContactQuery } from './contact.schema'
import { formatCuit } from './contact.utils'
import { paginate, toPaginated } from '@/lib/pagination'
import logger from '@/lib/logger'
import type { TenantContext } from '@/lib/tenancy'
import { whereOrg } from '@/lib/tenancy'

export async function listContacts(query: ContactQuery, ctx: TenantContext) {
  const { page, limit, search, type } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = whereOrg(ctx)
  if (type) where.type = type
  if (search) {
    where[Op.or as unknown as string] = [
      { legal_name: { [Op.iLike]: `%${search}%` } },
      { trade_name: { [Op.iLike]: `%${search}%` } },
      { first_name: { [Op.iLike]: `%${search}%` } },
      { last_name: { [Op.iLike]: `%${search}%` } },
      { job_title: { [Op.iLike]: `%${search}%` } },
      { cuit: { [Op.iLike]: `%${search}%` } },
    ]
  }

  const { rows, count } = await Contact.findAndCountAll({
    where,
    limit,
    offset,
    order: [['legal_name', 'ASC']],
    attributes: [
      'id', 'type', 'legal_name', 'trade_name', 'first_name', 'last_name', 'job_title',
      'cuit', 'iva_condition', 'email', 'phone', 'is_active',
    ],
  })

  return toPaginated(rows, count, page, limit)
}

export async function getContact(id: string, ctx: TenantContext) {
  const contact = await Contact.findOne({ where: whereOrg(ctx, { id }) })
  if (!contact) throw new Error('CONTACT_NOT_FOUND')
  return contact
}

export async function createContact(input: ContactInput, ctx: TenantContext, actorId: string) {
  const contact = await Contact.create({
    ...input,
    cuit: input.cuit ? formatCuit(input.cuit) : null,
    org_id: ctx.orgId,
    created_by: actorId,
    updated_by: actorId,
  })
  logger.info({ contactId: contact.id, actorId }, 'contact created')
  return contact
}

export async function updateContact(id: string, input: ContactUpdateInput, ctx: TenantContext, actorId: string) {
  const contact = await getContact(id, ctx)
  await contact.update({
    ...input,
    ...(input.cuit ? { cuit: formatCuit(input.cuit) } : {}),
    updated_by: actorId,
  })
  logger.info({ contactId: id, actorId }, 'contact updated')
  return contact
}

export async function deleteContact(id: string, ctx: TenantContext, actorId: string) {
  const contact = await getContact(id, ctx)
  await contact.update({ deleted_by: actorId })
  await contact.destroy()
  logger.info({ contactId: id, actorId }, 'contact soft-deleted')
}
