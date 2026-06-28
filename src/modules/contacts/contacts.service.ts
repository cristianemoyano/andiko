import 'server-only'
import { Op } from 'sequelize'
import Contact from './contact.model'
import type { ContactInput, ContactUpdateInput, ContactQuery } from './contact.schema'
import { contactSchema, contactUpdateSchema } from './contact.schema'
import { formatCuit, normalizeContactImportRow } from './contact.utils'
import { paginate, toPaginated } from '@/lib/pagination'
import logger from '@/lib/logger'
import type { TenantContext } from '@/lib/tenancy'
import { whereOrg } from '@/lib/tenancy'
import sequelize from '@/lib/db'
import {
  combineListWhere,
  importSourceListWhere,
  resolveListSource,
} from '@/modules/integrations/woocommerce/woo-list-filters'
import WoocommerceCustomerLink from '@/modules/integrations/woocommerce/woocommerce-customer-link.model'

export async function listContacts(query: ContactQuery, ctx: TenantContext) {
  const { page, limit, search, type, source } = query
  const { offset } = paginate(page, limit)

  const where = combineListWhere(
    whereOrg(ctx),
    type ? { type } : {},
    source ? importSourceListWhere(source, ctx.orgId, 'contact') : {},
    search
      ? {
          [Op.or]: [
            { legal_name: { [Op.iLike]: `%${search}%` } },
            { trade_name: { [Op.iLike]: `%${search}%` } },
            { first_name: { [Op.iLike]: `%${search}%` } },
            { last_name: { [Op.iLike]: `%${search}%` } },
            { job_title: { [Op.iLike]: `%${search}%` } },
            { cuit: { [Op.iLike]: `%${search}%` } },
          ],
        }
      : {},
  )

  const { rows, count } = await Contact.findAndCountAll({
    where,
    limit,
    offset,
    order: [['legal_name', 'ASC']],
    attributes: [
      'id', 'type', 'legal_name', 'trade_name', 'first_name', 'last_name', 'job_title',
      'cuit', 'iva_condition', 'email', 'phone', 'is_active', 'import_source', 'import_external_id',
    ],
  })

  const rowIds = rows.map((row) => row.id)
  const linkedContactIds = rowIds.length
    ? new Set(
        (
          await WoocommerceCustomerLink.findAll({
            where: { org_id: ctx.orgId, contact_id: { [Op.in]: rowIds } },
            attributes: ['contact_id'],
            raw: true,
          })
        ).map((link) => link.contact_id as string),
      )
    : new Set<string>()

  const data = rows.map((row) => ({
    ...row.toJSON(),
    source: resolveListSource(row.import_source, linkedContactIds.has(row.id)),
  }))

  return toPaginated(data, count, page, limit)
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

export type ImportAction = 'create' | 'update' | 'upsert'

export type ImportResult = {
  created: number
  updated: number
  skipped: number
  errors: { row: number; message: string }[]
}

export async function importContacts(
  rows: Record<string, string>[],
  action: ImportAction,
  ctx: TenantContext,
  actorId: string,
): Promise<ImportResult> {
  const errors: ImportResult['errors'] = []
  let created = 0
  let updated = 0
  let skipped = 0

  await sequelize.transaction(async (t) => {
    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2 // 1-based + header row
      const mapped = normalizeContactImportRow(rows[i])
      // Convert empty strings to undefined so optional/nullable Zod fields pass correctly
      const row = Object.fromEntries(
        Object.entries(mapped).map(([k, v]) => [k, v === '' ? undefined : v]),
      )

      if (action === 'create' || action === 'upsert') {
        const parsed = contactSchema.safeParse(row)
        if (!parsed.success) {
          const msgs = parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join(', ')
          errors.push({ row: rowNum, message: msgs })
          continue
        }
      } else {
        const parsed = contactUpdateSchema.safeParse(row)
        if (!parsed.success) {
          const msgs = parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join(', ')
          errors.push({ row: rowNum, message: msgs })
          continue
        }
      }

      const cuit = row.cuit ? formatCuit(row.cuit) : null
      const matchWhere = cuit
        ? { ...whereOrg(ctx), cuit }
        : { ...whereOrg(ctx), legal_name: row.legal_name }

      const existing = await Contact.findOne({ where: matchWhere, transaction: t })

      if (action === 'create') {
        if (existing) { skipped++; continue }
        const input = contactSchema.parse(row)
        await Contact.create({
          ...input,
          cuit: input.cuit ? formatCuit(input.cuit) : null,
          org_id: ctx.orgId,
          created_by: actorId,
          updated_by: actorId,
        }, { transaction: t })
        created++
      } else if (action === 'update') {
        if (!existing) { skipped++; continue }
        const input = contactUpdateSchema.parse(row)
        await existing.update({
          ...input,
          ...(input.cuit ? { cuit: formatCuit(input.cuit) } : {}),
          updated_by: actorId,
        }, { transaction: t })
        updated++
      } else {
        // upsert
        const input = contactSchema.parse(row)
        if (existing) {
          await existing.update({
            ...input,
            ...(input.cuit ? { cuit: formatCuit(input.cuit) } : {}),
            updated_by: actorId,
          }, { transaction: t })
          updated++
        } else {
          await Contact.create({
            ...input,
            cuit: input.cuit ? formatCuit(input.cuit) : null,
            org_id: ctx.orgId,
            created_by: actorId,
            updated_by: actorId,
          }, { transaction: t })
          created++
        }
      }
    }

    if (errors.length > 0) {
      throw Object.assign(new Error('IMPORT_VALIDATION_ERRORS'), { importErrors: errors })
    }
  })

  logger.info({ created, updated, skipped, actorId }, 'contacts imported')
  return { created, updated, skipped, errors: [] }
}
