import 'server-only'
import type { Transaction } from 'sequelize'
import { Op, UniqueConstraintError, ValidationError } from 'sequelize'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { whereAllowedBranches, type TenantContext } from '@/lib/tenancy'
import Invoice from '@/modules/sales/invoice.model'
import InvoiceItem from '@/modules/sales/invoice-item.model'
import CreditNote from '@/modules/sales/credit-note.model'
import DebitNote from '@/modules/sales/debit-note.model'
import SalesOrder from '@/modules/sales/sales-order.model'
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
import { resolveNextCbteNumero } from './afip-sequence.service'
import { isAfipCbteUniqueViolation } from './afip-sequence.utils'
import { AFIP_INVOICES_ISSUED_METRIC_KEY } from '@/modules/billing/billing-metrics.catalog'

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
  order_id?: string | null
  retries?: number
  update(values: Record<string, unknown>, options?: { transaction?: Transaction }): Promise<unknown>
  reload(options?: { transaction?: Transaction }): Promise<unknown>
}

function formatEmissionError(err: unknown): string {
  if (isAfipCbteUniqueViolation(err)) {
    return 'El número de comprobante AFIP ya está registrado en otra factura de la organización'
  }
  if (err instanceof ValidationError && err.errors.length > 0) {
    return err.errors.map(e => e.message).join('; ')
  }
  if (err instanceof UniqueConstraintError) {
    const constraint = String((err.parent as { constraint?: string } | undefined)?.constraint ?? '')
    if (constraint) return `Conflicto de datos (${constraint})`
  }
  return err instanceof Error ? err.message : String(err)
}

async function resolveContingencyEmissionsForDocument(
  documentId: string,
  orgId: string,
  ctx: TenantContext,
  meta: { sourceType: 'order'; sourceId: string; sourceLabel: string | null },
  emission: AfipEmission | null,
  t: Transaction,
) {
  const response = {
    self_healed: true,
    source_type: meta.sourceType,
    source_id: meta.sourceId,
    source_label: meta.sourceLabel,
  }

  const pending = await AfipEmission.findAll({
    where: {
      org_id: orgId,
      document_id: documentId,
      status: { [Op.in]: ['pending', 'error'] },
    },
    transaction: t,
  })

  for (const row of pending) {
    await row.update(
      { status: 'authorized', error: null, response, updated_by: ctx.userId },
      { transaction: t },
    )
  }

  if (emission && !pending.some(row => row.id === emission.id)) {
    await emission.update(
      { status: 'authorized', error: null, response, updated_by: ctx.userId },
      { transaction: t },
    )
  }
}

/**
 * POS path: the pedido already has CAE and no invoice on the order is fiscalized yet.
 * Copy fiscal data from the order — never from another invoice, and never reuse a CAE.
 */
async function trySyncCaeFromPosOrder(
  invoice: AfipDocumentInstance,
  ctx: TenantContext,
  emission: AfipEmission | null,
): Promise<boolean> {
  if (!invoice.order_id || invoice.afip_status === 'authorized') return false

  const siblingWithCae = await Invoice.findOne({
    where: {
      org_id: ctx.orgId,
      order_id: invoice.order_id,
      id: { [Op.ne]: invoice.id },
      cae: { [Op.ne]: null },
    },
    attributes: ['id', 'invoice_number'],
  })
  if (siblingWithCae) {
    logger.info(
      {
        invoiceId: invoice.id,
        orderId: invoice.order_id,
        existingInvoiceId: siblingWithCae.id,
        existingInvoiceNumber: siblingWithCae.invoice_number,
      },
      'order already has an invoiced sibling — will request a new CAE from AFIP',
    )
    return false
  }

  const order = await SalesOrder.findOne({
    where: { id: invoice.order_id, org_id: ctx.orgId },
    attributes: [
      'id', 'order_number', 'cae', 'cae_expiration', 'comprobante_tipo', 'punto_venta', 'cbte_numero',
      'afip_status', 'afip_observations',
    ],
  })
  if (!order?.cae || order.afip_status !== 'authorized') return false

  await sequelize.transaction(async (t) => {
    await invoice.update(
      {
        cae: order.cae,
        cae_expiration: order.cae_expiration,
        comprobante_tipo: order.comprobante_tipo,
        punto_venta: order.punto_venta,
        cbte_numero: order.cbte_numero,
        afip_status: 'authorized',
        afip_observations: order.afip_observations,
        updated_by: ctx.userId,
      },
      { transaction: t },
    )
    await resolveContingencyEmissionsForDocument(
      invoice.id,
      ctx.orgId,
      ctx,
      { sourceType: 'order', sourceId: order.id, sourceLabel: order.order_number },
      emission,
      t,
    )
  })

  logger.info(
    { invoiceId: invoice.id, orderId: invoice.order_id, cbteNumero: order.cbte_numero },
    'afip CAE synced from POS order to first invoice',
  )
  return true
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
  const CreditNoteItem = (await import('@/modules/sales/credit-note-item.model')).default
  const note = (await CreditNote.findOne({
    where: whereAllowedBranches(ctx, { id: creditNoteId }),
  })) as (AfipDocumentInstance & NoteTotals) | null
  if (!note) throw new Error('DOCUMENT_NOT_FOUND')

  const items = await CreditNoteItem.findAll({
    where: { credit_note_id: creditNoteId },
    order: [['sort_order', 'ASC']],
  })

  const lineItems = items.length > 0
    ? items.map(i => ({
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount_pct: i.discount_pct,
        iva_rate: i.iva_rate,
        tax_base: i.tax_base,
        tax_amount: i.tax_amount,
      }))
    : [headerLineItem(note.subtotal, note.discount_amount, note.tax_amount)]

  return authorize({
    documentType: 'credit_note',
    instance: note,
    kind: 'credit_note',
    lineItems,
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

  if (documentType === 'invoice' && (await trySyncCaeFromPosOrder(instance, ctx, null))) {
    await instance.reload()
    return instance
  }

  const [org, contact, branch] = await Promise.all([
    Organization.findByPk(ctx.orgId),
    Contact.findByPk(instance.contact_id),
    instance.branch_id ? Branch.findByPk(instance.branch_id) : Promise.resolve(null),
  ])
  if (!org) throw new Error('AFIP_ORG_NOT_FOUND')
  if (!contact) throw new Error('AFIP_CONTACT_REQUIRED')
  const puntoVenta = branch?.punto_venta ?? null
  if (!puntoVenta) throw new Error('AFIP_PUNTO_VENTA_REQUIRED')

  const wsfe = params.deps.wsfe ?? (await getAfipClients(ctx.orgId)).wsfe

  const { cbteTipo } = classifyComprobante(org.iva_condition, contact.iva_condition, kind)
  const ultimo = await wsfe.consultarUltimoAutorizado(puntoVenta, cbteTipo)
  const cbteNumero = await resolveNextCbteNumero(ctx.orgId, ultimo, puntoVenta, cbteTipo)

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
      const { recordMeteredUsage } = await import('@/modules/billing/usage-meter.service')
      void recordMeteredUsage({
        orgId: ctx.orgId,
        metricKey: AFIP_INVOICES_ISSUED_METRIC_KEY,
        quantity: 1,
        sourceId: `${documentType}:${instance.id}`,
        actorId: ctx.userId,
      }).catch(() => undefined)
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
    const message = formatEmissionError(err)
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
