import 'server-only'
import { Op } from 'sequelize'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import { whereAllowedBranches, type TenantContext } from '@/lib/tenancy'
import DebitNote from './debit-note.model'
import Invoice from './invoice.model'
import Contact from '@/modules/contacts/contact.model'
import { nextDocumentNumber } from './sales.utils'
import type { DebitNoteQuery, CreateDebitNoteInput, UpdateDebitNoteInput } from './debit-note.schema'

export async function listDebitNotes(query: DebitNoteQuery, ctx: TenantContext) {
  const { offset, limit } = paginate(query.page, query.limit)
  const where: Record<string, unknown> = { ...whereAllowedBranches(ctx, {}) }
  if (query.status) where.status = query.status
  if (query.contact_id) where.contact_id = query.contact_id
  if (query.invoice_id) where.invoice_id = query.invoice_id
  if (query.search) {
    where[Op.or as unknown as string] = [
      { debit_note_number: { [Op.iLike]: `%${query.search}%` } },
      { reason: { [Op.iLike]: `%${query.search}%` } },
    ]
  }

  const { rows, count } = await DebitNote.findAndCountAll({
    where,
    attributes: [
      'id', 'branch_id', 'contact_id', 'invoice_id', 'debit_note_number', 'status',
      'issue_date', 'currency', 'subtotal', 'discount_amount', 'tax_amount', 'total',
      'reason', 'notes', 'cae', 'afip_status', 'created_at', 'updated_at',
    ],
    include: [
      { model: Contact, as: 'contact', attributes: ['id', 'legal_name', 'trade_name'], required: false },
      { model: Invoice, as: 'invoice', attributes: ['id', 'invoice_number'], required: false },
    ],
    order: [['created_at', 'DESC']],
    limit,
    offset,
  })

  return toPaginated(rows, count, query.page, query.limit)
}

export async function getDebitNote(id: string, ctx: TenantContext) {
  const note = await DebitNote.findOne({
    where: whereAllowedBranches(ctx, { id }),
    include: [
      { model: Contact, as: 'contact', attributes: ['id', 'legal_name', 'trade_name'], required: false },
      { model: Invoice, as: 'invoice', attributes: ['id', 'invoice_number', 'status', 'total', 'balance'], required: false },
    ],
  })
  if (!note) throw new Error('DEBIT_NOTE_NOT_FOUND')
  return note
}

export async function createDebitNote(input: CreateDebitNoteInput, ctx: TenantContext) {
  const { orgId, userId } = ctx
  if (!orgId) throw new Error('ORG_CONTEXT_REQUIRED')

  return sequelize.transaction(async (t) => {
    const effectiveBranchId = input.branch_id ?? ctx.defaultBranchId
    if (!effectiveBranchId) throw new Error('BRANCH_REQUIRED')

    const debit_note_number = await nextDocumentNumber(orgId, effectiveBranchId, 'debit_note', t)

    const note = await DebitNote.create(
      {
        org_id: orgId,
        branch_id: effectiveBranchId,
        contact_id: input.contact_id ?? null,
        invoice_id: input.invoice_id ?? null,
        debit_note_number,
        status: 'draft',
        issue_date: input.issue_date ?? null,
        currency: input.currency,
        subtotal: input.subtotal,
        discount_amount: input.discount_amount ?? '0',
        tax_amount: input.tax_amount ?? '0',
        total: input.total,
        reason: input.reason ?? null,
        notes: input.notes ?? null,
        created_by: userId ?? null,
        updated_by: userId ?? null,
      },
      { transaction: t },
    )

    logger.info({ debitNoteId: note.id, debit_note_number, orgId }, 'debit note created')
    return note
  })
}

export async function updateDebitNote(id: string, input: UpdateDebitNoteInput, ctx: TenantContext) {
  const note = await DebitNote.findOne({ where: whereAllowedBranches(ctx, { id }) })
  if (!note) throw new Error('DEBIT_NOTE_NOT_FOUND')
  if (note.status !== 'draft') throw new Error('DEBIT_NOTE_NOT_EDITABLE')

  await note.update({
    contact_id: input.contact_id ?? note.contact_id,
    invoice_id: input.invoice_id ?? note.invoice_id,
    issue_date: input.issue_date ?? note.issue_date,
    currency: input.currency ?? note.currency,
    subtotal: input.subtotal ?? note.subtotal,
    discount_amount: input.discount_amount ?? note.discount_amount,
    tax_amount: input.tax_amount ?? note.tax_amount,
    total: input.total ?? note.total,
    reason: input.reason ?? note.reason,
    notes: input.notes ?? note.notes,
    updated_by: ctx.userId ?? null,
  })

  return note.reload()
}

export async function issueDebitNote(id: string, ctx: TenantContext) {
  return sequelize.transaction(async (t) => {
    const note = await DebitNote.findOne({ where: whereAllowedBranches(ctx, { id }), transaction: t, lock: true })
    if (!note) throw new Error('DEBIT_NOTE_NOT_FOUND')
    if (note.status !== 'draft') throw new Error('DEBIT_NOTE_ALREADY_ISSUED')

    await note.update(
      { status: 'issued', issue_date: note.issue_date ?? new Date(), updated_by: ctx.userId ?? null },
      { transaction: t },
    )

    logger.info({ debitNoteId: note.id }, 'debit note issued')
    return note.reload({ transaction: t })
  })
}

export async function cancelDebitNote(id: string, ctx: TenantContext) {
  return sequelize.transaction(async (t) => {
    const note = await DebitNote.findOne({ where: whereAllowedBranches(ctx, { id }), transaction: t, lock: true })
    if (!note) throw new Error('DEBIT_NOTE_NOT_FOUND')
    if (note.status === 'cancelled') throw new Error('DEBIT_NOTE_ALREADY_CANCELLED')

    await note.update({ status: 'cancelled', updated_by: ctx.userId ?? null }, { transaction: t })

    logger.info({ debitNoteId: note.id }, 'debit note cancelled')
    return note.reload({ transaction: t })
  })
}

export async function deleteDebitNote(id: string, ctx: TenantContext) {
  const note = await DebitNote.findOne({ where: whereAllowedBranches(ctx, { id }) })
  if (!note) throw new Error('DEBIT_NOTE_NOT_FOUND')
  if (note.status !== 'draft') throw new Error('DEBIT_NOTE_NOT_DELETABLE')

  await note.destroy()
  logger.info({ debitNoteId: id }, 'debit note deleted')
}
