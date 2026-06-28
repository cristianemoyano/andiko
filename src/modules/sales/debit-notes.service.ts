import 'server-only'
import { Op } from 'sequelize'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import { combineListWhere } from '@/modules/integrations/woocommerce/woo-list-filters'
import type { TenantContext } from '@/lib/tenancy'
import { whereBranch } from '@/lib/tenancy'
import { whereSalesDocumentScopeViaInvoice } from './sales-scope'
import { FISCAL_NUMBER_SOURCE_ATTRS } from '@/lib/fiscal-document-number'
import DebitNote from './debit-note.model'
import Invoice from './invoice.model'
import Contact from '@/modules/contacts/contact.model'
import Branch from '@/modules/auth/branch.model'
import { ensureSalesBranchAssociations, BRANCH_AFIP_ATTRIBUTES } from './sales-branch-associations'
import { buildBranchRenumberPatch, assertDraftBranchChange } from '@/lib/branch-document-renumber'
import { nextDocumentNumber } from './sales.utils'
import type { DebitNoteQuery, CreateDebitNoteInput, UpdateDebitNoteInput } from './debit-note.schema'

export async function listDebitNotes(query: DebitNoteQuery, ctx: TenantContext) {
  const { offset, limit } = paginate(query.page, query.limit)
  const where = combineListWhere(
    whereSalesDocumentScopeViaInvoice(ctx),
    query.status ? { status: query.status } : {},
    query.contact_id ? { contact_id: query.contact_id } : {},
    query.invoice_id ? { invoice_id: query.invoice_id } : {},
    query.search
      ? {
          [Op.or]: [
            { debit_note_number: { [Op.iLike]: `%${query.search}%` } },
            { '$contact.legal_name$': { [Op.iLike]: `%${query.search}%` } },
            { '$contact.trade_name$': { [Op.iLike]: `%${query.search}%` } },
            { '$invoice.invoice_number$': { [Op.iLike]: `%${query.search}%` } },
          ],
        }
      : {},
  ) as Record<string, unknown>

  const { rows, count } = await DebitNote.findAndCountAll({
    where,
    subQuery: query.search || ctx.salesScopeOwn ? false : undefined,
    attributes: [
      'id', 'branch_id', 'contact_id', 'invoice_id', 'debit_note_number', 'status',
      'issue_date', 'currency', 'subtotal', 'discount_amount', 'tax_amount', 'total',
      'reason', 'notes', 'created_at', 'updated_at',
      ...FISCAL_NUMBER_SOURCE_ATTRS,
    ],
    include: [
      { model: Contact, as: 'contact', attributes: ['id', 'legal_name', 'trade_name', 'cuit'], required: false },
      {
        model: Invoice,
        as: 'invoice',
        attributes: ['id', 'invoice_number', 'salesperson_id', 'created_by', ...FISCAL_NUMBER_SOURCE_ATTRS],
        required: false,
      },
    ],
    order: [['created_at', 'DESC']],
    limit,
    offset,
  })

  return toPaginated(rows, count, query.page, query.limit)
}

export async function getDebitNote(id: string, ctx: TenantContext) {
  ensureSalesBranchAssociations()

  const note = await DebitNote.findOne({
    where: whereSalesDocumentScopeViaInvoice(ctx, { id }),
    include: [
      { model: Branch, as: 'branch', attributes: [...BRANCH_AFIP_ATTRIBUTES], required: false },
      { model: Contact, as: 'contact', attributes: ['id', 'legal_name', 'trade_name', 'cuit'], required: false },
      {
        model: Invoice,
        as: 'invoice',
        attributes: ['id', 'invoice_number', 'status', 'total', 'balance', ...FISCAL_NUMBER_SOURCE_ATTRS],
        required: false,
      },
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
  const { orgId } = ctx
  if (!orgId) throw new Error('ORG_CONTEXT_REQUIRED')

  return sequelize.transaction(async (t) => {
    const note = await DebitNote.findOne({ where: whereSalesDocumentScopeViaInvoice(ctx, { id }), transaction: t, lock: true })
    if (!note) throw new Error('DEBIT_NOTE_NOT_FOUND')
    if (note.status !== 'draft') throw new Error('DEBIT_NOTE_NOT_EDITABLE')

    const patch: Record<string, unknown> = {
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
    }

    if (input.branch_id && input.branch_id !== note.branch_id) {
      assertDraftBranchChange(note.status)
      void whereBranch(ctx, input.branch_id)
      Object.assign(patch, await buildBranchRenumberPatch({
        orgId,
        currentBranchId: note.branch_id,
        nextBranchId: input.branch_id,
        numberField: 'debit_note_number',
        resolveNextNumber: (oid, branchId, tx) => nextDocumentNumber(oid, branchId, 'debit_note', tx),
        t,
      }))
    }

    await note.update(patch, { transaction: t })
    return note.reload({ transaction: t })
  })
}

export async function issueDebitNote(id: string, ctx: TenantContext) {
  return sequelize.transaction(async (t) => issueDebitNoteInTransaction(id, ctx, t))
}

export async function issueDebitNoteInTransaction(
  id: string,
  ctx: TenantContext,
  t: import('sequelize').Transaction,
) {
  const note = await DebitNote.findOne({ where: whereSalesDocumentScopeViaInvoice(ctx, { id }), transaction: t, lock: true })
  if (!note) throw new Error('DEBIT_NOTE_NOT_FOUND')
  if (note.status !== 'draft') throw new Error('DEBIT_NOTE_ALREADY_ISSUED')

  await note.update(
    { status: 'issued', issue_date: note.issue_date ?? new Date(), updated_by: ctx.userId ?? null },
    { transaction: t },
  )

  logger.info({ debitNoteId: note.id }, 'debit note issued')
  return note.reload({ transaction: t })
}

export async function cancelDebitNote(id: string, ctx: TenantContext) {
  return sequelize.transaction(async (t) => {
    const note = await DebitNote.findOne({ where: whereSalesDocumentScopeViaInvoice(ctx, { id }), transaction: t, lock: true })
    if (!note) throw new Error('DEBIT_NOTE_NOT_FOUND')
    if (note.status === 'cancelled') throw new Error('DEBIT_NOTE_ALREADY_CANCELLED')

    await note.update({ status: 'cancelled', updated_by: ctx.userId ?? null }, { transaction: t })

    logger.info({ debitNoteId: note.id }, 'debit note cancelled')
    return note.reload({ transaction: t })
  })
}

export async function deleteDebitNote(id: string, ctx: TenantContext) {
  const note = await DebitNote.findOne({ where: whereSalesDocumentScopeViaInvoice(ctx, { id }) })
  if (!note) throw new Error('DEBIT_NOTE_NOT_FOUND')
  if (note.status !== 'draft') throw new Error('DEBIT_NOTE_NOT_DELETABLE')

  await note.destroy()
  logger.info({ debitNoteId: id }, 'debit note deleted')
}
