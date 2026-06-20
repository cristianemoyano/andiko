import 'server-only'
import type { Transaction } from 'sequelize'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { whereAllowedBranches, type TenantContext } from '@/lib/tenancy'
import Invoice from '@/modules/sales/invoice.model'
import InvoiceItem from '@/modules/sales/invoice-item.model'
import CreditNote from '@/modules/sales/credit-note.model'
import DebitNote from '@/modules/sales/debit-note.model'
import Branch from '@/modules/auth/branch.model'
import Organization from '@/modules/auth/organization.model'
import Contact from '@/modules/contacts/contact.model'
import AfipEmission from './afip-emission.model'
import type { AfipEmissionDocType } from './afip-emission.model'
import { classifyComprobante } from './comprobante-classifier'
import { headerLineItem, type AfipLineItem } from './iva-aggregation'
import { buildFECAERequest, parseAfipDate, type AfipAssociatedComprobante } from './wsfe-payload'
import { FE_RESULT, type ComprobanteKind } from './afip-codes'
import { getAfipClients } from './afip-client.factory'
import type { WsfeClient } from './wsfe.client'

export type EmissionDeps = { wsfe?: WsfeClient }

/** Structural type for any document model instance carrying AFIP fields. */
type AfipDocumentInstance = {
  id: string
  org_id: string | null
  status: string
  contact_id: string | null
  branch_id: string | null
  issue_date: Date | null
  afip_status: string
  retries?: number
  update(values: Record<string, unknown>, options?: { transaction?: Transaction }): Promise<unknown>
  reload(options?: { transaction?: Transaction }): Promise<unknown>
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function requestCAEForInvoice(invoiceId: string, ctx: TenantContext, deps: EmissionDeps = {}) {
  const invoice = (await Invoice.findOne({
    where: whereAllowedBranches(ctx, { id: invoiceId }),
  })) as AfipDocumentInstance | null
  if (!invoice) throw new Error('DOCUMENT_NOT_FOUND')

  const items = await InvoiceItem.findAll({ where: { invoice_id: invoiceId } })
  const lineItems: AfipLineItem[] = items.map((i) => ({
    iva_rate: i.iva_rate,
    tax_base: i.tax_base,
    tax_amount: i.tax_amount,
  }))

  return authorize({
    documentType: 'invoice',
    instance: invoice,
    kind: 'invoice',
    lineItems,
    associated: null,
    ctx,
    deps,
  })
}

export async function requestCAEForCreditNote(creditNoteId: string, ctx: TenantContext, deps: EmissionDeps = {}) {
  const note = (await CreditNote.findOne({
    where: whereAllowedBranches(ctx, { id: creditNoteId }),
  })) as (AfipDocumentInstance & NoteTotals) | null
  if (!note) throw new Error('DOCUMENT_NOT_FOUND')

  return authorize({
    documentType: 'credit_note',
    instance: note,
    kind: 'credit_note',
    lineItems: [headerLineItem(note.subtotal, note.discount_amount, note.tax_amount)],
    associated: await associatedFromInvoice(note.invoice_id),
    ctx,
    deps,
  })
}

export async function requestCAEForDebitNote(debitNoteId: string, ctx: TenantContext, deps: EmissionDeps = {}) {
  const note = (await DebitNote.findOne({
    where: whereAllowedBranches(ctx, { id: debitNoteId }),
  })) as (AfipDocumentInstance & NoteTotals) | null
  if (!note) throw new Error('DOCUMENT_NOT_FOUND')

  return authorize({
    documentType: 'debit_note',
    instance: note,
    kind: 'debit_note',
    lineItems: [headerLineItem(note.subtotal, note.discount_amount, note.tax_amount)],
    associated: await associatedFromInvoice(note.invoice_id),
    ctx,
    deps,
  })
}

type NoteTotals = { subtotal: string; discount_amount: string; tax_amount: string; invoice_id: string | null }

// ── Core ─────────────────────────────────────────────────────────────────────

type AuthorizeParams = {
  documentType: AfipEmissionDocType
  instance: AfipDocumentInstance
  kind: ComprobanteKind
  lineItems: AfipLineItem[]
  associated: AfipAssociatedComprobante | null
  ctx: TenantContext
  deps: EmissionDeps
}

async function authorize(params: AuthorizeParams) {
  const { documentType, instance, kind, lineItems, associated, ctx } = params

  if (instance.afip_status === 'authorized') throw new Error('AFIP_ALREADY_AUTHORIZED')
  if (instance.status === 'draft' || instance.status === 'cancelled') throw new Error('AFIP_DOCUMENT_NOT_ISSUED')
  if (!instance.contact_id) throw new Error('AFIP_CONTACT_REQUIRED')

  const [org, contact, branch] = await Promise.all([
    Organization.findByPk(ctx.orgId),
    Contact.findByPk(instance.contact_id),
    instance.branch_id ? Branch.findByPk(instance.branch_id) : Promise.resolve(null),
  ])
  if (!org) throw new Error('AFIP_ORG_NOT_FOUND')
  if (!contact) throw new Error('AFIP_CONTACT_REQUIRED')
  const puntoVenta = branch?.punto_venta ?? null
  if (!puntoVenta) throw new Error('AFIP_PUNTO_VENTA_REQUIRED')

  const wsfe = params.deps.wsfe ?? (await getAfipClients()).wsfe

  const { cbteTipo } = classifyComprobante(org.iva_condition, contact.iva_condition, kind)
  const ultimo = await wsfe.consultarUltimoAutorizado(puntoVenta, cbteTipo)
  const cbteNumero = ultimo + 1

  const req = buildFECAERequest({
    org: { iva_condition: org.iva_condition },
    contact: { iva_condition: contact.iva_condition, cuit: contact.cuit },
    doc: { kind, issueDate: instance.issue_date ?? new Date(), items: lineItems, associated },
    puntoVenta,
    cbteNumero,
  })

  const emission = await AfipEmission.create({
    org_id: ctx.orgId,
    document_type: documentType,
    document_id: instance.id,
    cbte_tipo: req.cbteTipo,
    punto_venta: puntoVenta,
    status: 'pending',
    request: req as unknown as Record<string, unknown>,
    created_by: ctx.userId,
    updated_by: ctx.userId,
    last_attempt_at: new Date(),
  })

  logger.info(
    { documentType, documentId: instance.id, cbteTipo: req.cbteTipo, puntoVenta, cbteNumero, orgId: ctx.orgId },
    'afip CAE request started',
  )

  try {
    const result = await wsfe.solicitarCAE(req)

    if (result.resultado === FE_RESULT.APROBADO && result.cae) {
      await sequelize.transaction(async (t) => {
        await instance.update(
          {
            cae: result.cae,
            cae_expiration: result.caeVto ? parseAfipDate(result.caeVto) : null,
            comprobante_tipo: req.cbteTipo,
            punto_venta: puntoVenta,
            cbte_numero: cbteNumero,
            afip_status: 'authorized',
            afip_observations: result.observations,
            updated_by: ctx.userId,
          },
          { transaction: t },
        )
        await emission.update(
          { status: 'authorized', response: result as unknown as Record<string, unknown>, observations: result.observations },
          { transaction: t },
        )
      })
      logger.info({ documentType, documentId: instance.id, cae: result.cae, cbteNumero }, 'afip CAE authorized')
    } else {
      await sequelize.transaction(async (t) => {
        await instance.update(
          { afip_status: 'rejected', afip_observations: result.observations, updated_by: ctx.userId },
          { transaction: t },
        )
        await emission.update(
          { status: 'rejected', response: result as unknown as Record<string, unknown>, observations: result.observations },
          { transaction: t },
        )
      })
      logger.warn({ documentType, documentId: instance.id, observations: result.observations }, 'afip CAE rejected')
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await instance.update({ afip_status: 'contingency', updated_by: ctx.userId })
    await emission.update({ status: 'error', error: message, retries: (emission.retries ?? 0) + 1 })
    logger.error({ documentType, documentId: instance.id, err: message }, 'afip CAE transport error — queued for contingency')
  }

  await instance.reload()
  return instance
}

async function associatedFromInvoice(invoiceId: string | null): Promise<AfipAssociatedComprobante | null> {
  if (!invoiceId) return null
  const invoice = await Invoice.findByPk(invoiceId, {
    attributes: ['comprobante_tipo', 'punto_venta', 'cbte_numero'],
  })
  if (!invoice || !invoice.comprobante_tipo || !invoice.punto_venta || !invoice.cbte_numero) return null
  return {
    cbteTipo: invoice.comprobante_tipo as AfipAssociatedComprobante['cbteTipo'],
    puntoVenta: invoice.punto_venta,
    cbteNumero: invoice.cbte_numero,
  }
}
