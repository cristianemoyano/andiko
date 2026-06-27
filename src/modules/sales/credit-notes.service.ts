import 'server-only'
import { Op } from 'sequelize'
import Decimal from 'decimal.js'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { paginate, toPaginated } from '@/lib/pagination'
import { whereAllowedBranches, whereBranch, type TenantContext } from '@/lib/tenancy'
import { FISCAL_NUMBER_SOURCE_ATTRS } from '@/lib/fiscal-document-number'
import CreditNote from './credit-note.model'
import Invoice from './invoice.model'
import Contact from '@/modules/contacts/contact.model'
import Branch from '@/modules/auth/branch.model'
import { ensureSalesBranchAssociations, BRANCH_AFIP_ATTRIBUTES } from './sales-branch-associations'
import { buildBranchRenumberPatch, assertDraftBranchChange } from '@/lib/branch-document-renumber'
import { nextDocumentNumber } from './sales.utils'
import type { CreditNoteQuery, CreateCreditNoteInput, UpdateCreditNoteInput } from './credit-note.schema'

export async function listCreditNotes(query: CreditNoteQuery, ctx: TenantContext) {
  const { offset, limit } = paginate(query.page, query.limit)
  const where: Record<string, unknown> = {
    ...whereAllowedBranches(ctx, {}),
  }
  if (query.status) where.status = query.status
  if (query.contact_id) where.contact_id = query.contact_id
  if (query.invoice_id) where.invoice_id = query.invoice_id
  if (query.search) {
    const term = `%${query.search}%`
    where[Op.or as unknown as string] = [
      { credit_note_number: { [Op.iLike]: term } },
      { '$contact.legal_name$': { [Op.iLike]: term } },
      { '$contact.trade_name$': { [Op.iLike]: term } },
      { '$invoice.invoice_number$': { [Op.iLike]: term } },
    ]
  }

  const { rows, count } = await CreditNote.findAndCountAll({
    where,
    subQuery: query.search ? false : undefined,
    attributes: [
      'id', 'branch_id', 'contact_id', 'invoice_id', 'credit_note_number', 'status',
      'issue_date', 'currency', 'subtotal', 'discount_amount', 'tax_amount', 'total',
      'applied_amount', 'remaining', 'reason', 'notes', 'created_at', 'updated_at',
      ...FISCAL_NUMBER_SOURCE_ATTRS,
    ],
    include: [
      { model: Contact, as: 'contact', attributes: ['id', 'legal_name', 'trade_name', 'cuit'], required: false },
      {
        model: Invoice,
        as: 'invoice',
        attributes: ['id', 'invoice_number', ...FISCAL_NUMBER_SOURCE_ATTRS],
        required: false,
      },
    ],
    order: [['created_at', 'DESC']],
    limit,
    offset,
  })

  return toPaginated(rows, count, query.page, query.limit)
}

export async function getCreditNote(id: string, ctx: TenantContext) {
  ensureSalesBranchAssociations()

  const note = await CreditNote.findOne({
    where: whereAllowedBranches(ctx, { id }),
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
  if (!note) throw new Error('CREDIT_NOTE_NOT_FOUND')
  return note
}

export async function createCreditNote(input: CreateCreditNoteInput, ctx: TenantContext) {
  const { orgId, userId } = ctx
  if (!orgId) throw new Error('ORG_CONTEXT_REQUIRED')

  return sequelize.transaction(async (t) => {
    const effectiveBranchId = input.branch_id ?? ctx.defaultBranchId
    if (!effectiveBranchId) throw new Error('BRANCH_REQUIRED')

    const credit_note_number = await nextDocumentNumber(orgId, effectiveBranchId, 'credit_note', t)

    const note = await CreditNote.create(
      {
        org_id: orgId,
        branch_id: effectiveBranchId,
        contact_id: input.contact_id ?? null,
        invoice_id: input.invoice_id ?? null,
        credit_note_number,
        status: 'draft',
        issue_date: input.issue_date ?? null,
        currency: input.currency,
        subtotal: input.subtotal,
        discount_amount: input.discount_amount ?? '0',
        tax_amount: input.tax_amount ?? '0',
        total: input.total,
        applied_amount: '0',
        remaining: input.total,
        reason: input.reason ?? null,
        notes: input.notes ?? null,
        created_by: userId ?? null,
        updated_by: userId ?? null,
      },
      { transaction: t },
    )

    logger.info({ creditNoteId: note.id, credit_note_number, orgId }, 'credit note created')
    return note
  })
}

export async function updateCreditNote(id: string, input: UpdateCreditNoteInput, ctx: TenantContext) {
  const { orgId } = ctx
  if (!orgId) throw new Error('ORG_CONTEXT_REQUIRED')

  return sequelize.transaction(async (t) => {
    const note = await CreditNote.findOne({ where: whereAllowedBranches(ctx, { id }), transaction: t, lock: true })
    if (!note) throw new Error('CREDIT_NOTE_NOT_FOUND')
    if (note.status !== 'draft') throw new Error('CREDIT_NOTE_NOT_EDITABLE')

    const total = input.total ?? note.total
    const applied = note.applied_amount
    const remaining = new Decimal(total).minus(new Decimal(applied)).toFixed(2)

    const patch: Record<string, unknown> = {
      contact_id: input.contact_id ?? note.contact_id,
      invoice_id: input.invoice_id ?? note.invoice_id,
      issue_date: input.issue_date ?? note.issue_date,
      currency: input.currency ?? note.currency,
      subtotal: input.subtotal ?? note.subtotal,
      discount_amount: input.discount_amount ?? note.discount_amount,
      tax_amount: input.tax_amount ?? note.tax_amount,
      total,
      remaining,
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
        numberField: 'credit_note_number',
        resolveNextNumber: (oid, branchId, tx) => nextDocumentNumber(oid, branchId, 'credit_note', tx),
        t,
      }))
    }

    await note.update(patch, { transaction: t })
    return note.reload({ transaction: t })
  })
}

export async function issueCreditNote(id: string, ctx: TenantContext) {
  return sequelize.transaction(async (t) => issueCreditNoteInTransaction(id, ctx, t))
}

export async function issueCreditNoteInTransaction(
  id: string,
  ctx: TenantContext,
  t: import('sequelize').Transaction,
) {
  const note = await CreditNote.findOne({
    where: whereAllowedBranches(ctx, { id }),
    transaction: t,
    lock: true,
  })
  if (!note) throw new Error('CREDIT_NOTE_NOT_FOUND')
  if (note.status !== 'draft') throw new Error('CREDIT_NOTE_ALREADY_ISSUED')

  await note.update(
    { status: 'issued', issue_date: note.issue_date ?? new Date(), updated_by: ctx.userId ?? null },
    { transaction: t },
  )

  if (note.invoice_id) {
    await applyCreditNoteToInvoice(note, t, ctx)
  }

  logger.info({ creditNoteId: note.id }, 'credit note issued')
  return note.reload({ transaction: t })
}

export async function cancelCreditNote(id: string, ctx: TenantContext) {
  return sequelize.transaction(async (t) => {
    const note = await CreditNote.findOne({
      where: whereAllowedBranches(ctx, { id }),
      transaction: t,
      lock: true,
    })
    if (!note) throw new Error('CREDIT_NOTE_NOT_FOUND')
    if (note.status === 'cancelled') throw new Error('CREDIT_NOTE_ALREADY_CANCELLED')

    const wasIssued = note.status === 'issued'
    await note.update(
      { status: 'cancelled', updated_by: ctx.userId ?? null },
      { transaction: t },
    )

    // Reverse application if it was issued and linked to an invoice
    if (wasIssued && note.invoice_id) {
      await reverseCreditNoteFromInvoice(note, t, ctx)
    }

    logger.info({ creditNoteId: note.id }, 'credit note cancelled')
    return note.reload({ transaction: t })
  })
}

export async function deleteCreditNote(id: string, ctx: TenantContext) {
  const note = await CreditNote.findOne({ where: whereAllowedBranches(ctx, { id }) })
  if (!note) throw new Error('CREDIT_NOTE_NOT_FOUND')
  if (note.status !== 'draft') throw new Error('CREDIT_NOTE_NOT_DELETABLE')

  await note.destroy()
  logger.info({ creditNoteId: id }, 'credit note deleted')
}

async function applyCreditNoteToInvoice(note: CreditNote, t: import('sequelize').Transaction, ctx: TenantContext): Promise<void> {
  const invoice = await Invoice.findOne({
    where: whereAllowedBranches(ctx, { id: note.invoice_id }),
    transaction: t,
    lock: true,
  })
  if (!invoice) return

  const creditAmount = new Decimal(note.total)
  const currentBalance = new Decimal(invoice.balance)
  const applied = Decimal.min(creditAmount, currentBalance)

  const newBalance = currentBalance.minus(applied)
  const newPaidAmount = new Decimal(invoice.paid_amount).plus(applied)

  let newStatus = invoice.status
  if (newBalance.lte(0)) newStatus = 'paid'
  else if (newPaidAmount.gt(0)) newStatus = 'partially_paid'

  await invoice.update(
    {
      balance: newBalance.toFixed(2),
      paid_amount: newPaidAmount.toFixed(2),
      status: newStatus,
      updated_by: ctx.userId ?? null,
    },
    { transaction: t },
  )

  await note.update(
    {
      applied_amount: applied.toFixed(2),
      remaining: creditAmount.minus(applied).toFixed(2),
    },
    { transaction: t },
  )
}

async function reverseCreditNoteFromInvoice(note: CreditNote, t: import('sequelize').Transaction, ctx: TenantContext): Promise<void> {
  const invoice = await Invoice.findOne({
    where: whereAllowedBranches(ctx, { id: note.invoice_id }),
    transaction: t,
    lock: true,
  })
  if (!invoice) return

  const applied = new Decimal(note.applied_amount)
  if (applied.lte(0)) return

  const newPaidAmount = Decimal.max(new Decimal(invoice.paid_amount).minus(applied), new Decimal(0))
  const newBalance = new Decimal(invoice.total).minus(newPaidAmount)

  let newStatus = invoice.status
  if (newBalance.lte(0)) newStatus = 'paid'
  else if (newPaidAmount.gt(0)) newStatus = 'partially_paid'
  else newStatus = 'issued'

  await invoice.update(
    {
      balance: newBalance.toFixed(2),
      paid_amount: newPaidAmount.toFixed(2),
      status: newStatus,
      updated_by: ctx.userId ?? null,
    },
    { transaction: t },
  )

  await note.update({ applied_amount: '0.00', remaining: note.total }, { transaction: t })
}
