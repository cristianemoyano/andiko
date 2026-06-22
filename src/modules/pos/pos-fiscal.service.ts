import 'server-only'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import type { PosDeviceContext } from '@/lib/pos-auth'
import Branch from '@/modules/auth/branch.model'
import Organization from '@/modules/auth/organization.model'
import Contact from '@/modules/contacts/contact.model'
import PosDevice from '@/modules/pos/pos-device.model'
import SalesOrder from '@/modules/sales/sales-order.model'
import SalesOrderItem from '@/modules/sales/sales-order-item.model'
import AfipEmission from '@/modules/afip/afip-emission.model'
import { getAfipClients } from '@/modules/afip/afip-client.factory'
import { buildAfipQrUrl } from '@/modules/afip/afip-qr'
import { classifyComprobante } from '@/modules/afip/comprobante-classifier'
import { buildFECAERequest, parseAfipDate, type FECAERequest } from '@/modules/afip/wsfe-payload'
import { CBTE_TIPO, FE_RESULT, type CbteTipo, type ComprobanteLetra } from '@/modules/afip/afip-codes'
import type { AfipLineItem } from '@/modules/afip/iva-aggregation'
import type { EmissionDeps } from '@/modules/afip/afip-emission.service'
import type { IvaCondition } from '@/modules/contacts/contact.model'
import { getPosConfig } from '@/modules/pos/pos-config.service'
import { formatFiscalTicketNumber } from '@/modules/pos/pos-fiscal.utils'
import type { PosSaleAuthorizeInput } from '@/modules/pos/pos-fiscal.schema'
import { upsertPosSalesOrder } from '@/modules/pos/pos-sales-sync.service'
import { finalizePosSaleInErp } from '@/modules/pos/pos-sales-finalize.service'
import Invoice from '@/modules/sales/invoice.model'
import {
  afipCbteUsedByOtherInvoice,
  getMaxAuthorizedCbteNumero,
  isAfipCbteUniqueViolation,
} from '@/modules/pos/pos-afip-sequence.service'
import type { WsfeClient } from '@/modules/afip/wsfe.client'

export type PosFiscalAuthorizeResult = {
  pos_sale_id: string
  cloud_id: string
  ticket_number: string
  punto_venta: number
  comprobante_tipo: number
  cbte_numero: number
  cae: string | null
  cae_expiration: string | null
  afip_status: string
  qr_url: string | null
  observations: Array<{ code: number; msg: string }>
}

const CF_CONTACT = {
  iva_condition: 'consumidor_final' as IvaCondition,
  cuit: null as string | null,
}

function letraForCbteTipo(cbteTipo: CbteTipo): ComprobanteLetra {
  if (cbteTipo === CBTE_TIPO.FACTURA_A || cbteTipo === CBTE_TIPO.NOTA_DEBITO_A || cbteTipo === CBTE_TIPO.NOTA_CREDITO_A) {
    return 'A'
  }
  if (
    cbteTipo === CBTE_TIPO.FACTURA_C
    || cbteTipo === CBTE_TIPO.NOTA_DEBITO_C
    || cbteTipo === CBTE_TIPO.NOTA_CREDITO_C
  ) {
    return 'C'
  }
  return 'B'
}

function resolvePosCbteTipo(
  orgIva: Organization['iva_condition'],
  receiverIva: IvaCondition,
  configuredCodigo: string | null | undefined,
): CbteTipo {
  const code = configuredCodigo?.replace(/^0+/, '') ?? ''
  if (code === '83') return CBTE_TIPO.TIQUE
  return classifyComprobante(orgIva, receiverIva, 'invoice').cbteTipo
}

function buildPosFECAERequest(params: {
  org: Organization
  contact: { iva_condition: IvaCondition; cuit: string | null }
  items: AfipLineItem[]
  issueDate: Date | string
  puntoVenta: number
  cbteNumero: number
  cbteTipo: CbteTipo
}): FECAERequest {
  const base = buildFECAERequest({
    org: { iva_condition: params.org.iva_condition },
    contact: params.contact,
    doc: { kind: 'invoice', issueDate: params.issueDate, items: params.items, associated: null },
    puntoVenta: params.puntoVenta,
    cbteNumero: params.cbteNumero,
  })
  return { ...base, cbteTipo: params.cbteTipo, letra: letraForCbteTipo(params.cbteTipo) }
}

function buildQrUrl(org: Organization, req: FECAERequest, cbteNumero: number, cae: string): string | null {
  const cuitDigits = (org.cuit ?? '').replace(/\D/g, '')
  if (cuitDigits.length !== 11) return null
  const fecha = `${req.cbteFch.slice(0, 4)}-${req.cbteFch.slice(4, 6)}-${req.cbteFch.slice(6, 8)}`
  return buildAfipQrUrl({
    fecha,
    cuit: Number(cuitDigits),
    ptoVta: req.puntoVenta,
    tipoCmp: req.cbteTipo,
    nroCmp: cbteNumero,
    importe: Number(req.impTotal),
    moneda: req.monId,
    ctz: req.monCotiz,
    tipoDocRec: req.docTipo,
    nroDocRec: req.docNro,
    codAut: Number(cae),
  })
}

async function resolveNextCbteNumero(
  orgId: string,
  wsfe: WsfeClient,
  puntoVenta: number,
  cbteTipo: CbteTipo,
): Promise<number> {
  const [fromWsfe, fromDb] = await Promise.all([
    wsfe.consultarUltimoAutorizado(puntoVenta, cbteTipo),
    getMaxAuthorizedCbteNumero(orgId, puntoVenta, cbteTipo),
  ])
  return Math.max(fromWsfe, fromDb) + 1
}

async function clearOrderFiscalFields(order: SalesOrder): Promise<void> {
  await order.update({
    cae: null,
    cae_expiration: null,
    cbte_numero: null,
    comprobante_tipo: null,
    fiscal_ticket_number: null,
    afip_status: 'pending',
    afip_observations: null,
  })
  await order.reload()
}

function orderToFiscalResult(order: SalesOrder, qrUrl: string | null): PosFiscalAuthorizeResult {
  return {
    pos_sale_id: order.pos_sale_id!,
    cloud_id: order.id,
    ticket_number: order.fiscal_ticket_number ?? formatFiscalTicketNumber(order.punto_venta!, order.cbte_numero!),
    punto_venta: order.punto_venta!,
    comprobante_tipo: order.comprobante_tipo!,
    cbte_numero: order.cbte_numero!,
    cae: order.cae,
    cae_expiration: order.cae_expiration ? String(order.cae_expiration).slice(0, 10) : null,
    afip_status: order.afip_status,
    qr_url: qrUrl,
    observations: order.afip_observations ?? [],
  }
}

/** Upserts the POS sale in cloud and requests AFIP CAE (WSFE). */
export async function authorizePosSale(
  ctx: PosDeviceContext,
  input: PosSaleAuthorizeInput,
  deps: EmissionDeps = {},
): Promise<PosFiscalAuthorizeResult> {
  const order = await upsertPosSalesOrder(ctx, input)

  const org = await Organization.findByPk(ctx.orgId)
  if (!org) throw new Error('AFIP_ORG_NOT_FOUND')

  const existingInvoice = await Invoice.findOne({
    where: { order_id: order.id, org_id: ctx.orgId },
    attributes: ['id'],
  })

  if (order.cae && order.punto_venta && order.cbte_numero && order.comprobante_tipo) {
    if (order.afip_status !== 'authorized') {
      await order.update({ afip_status: 'authorized' })
    }

    let shouldReissueCae = false

    if (!existingInvoice) {
      const cbteConflict = await afipCbteUsedByOtherInvoice(
        ctx.orgId,
        order.punto_venta,
        order.comprobante_tipo,
        order.cbte_numero,
        order.id,
      )
      if (cbteConflict) {
        logger.warn(
          { orderId: order.id, cbteNumero: order.cbte_numero, puntoVenta: order.punto_venta },
          'pos afip cbte already invoiced on another order — re-issuing CAE',
        )
        shouldReissueCae = true
      } else {
        try {
          await finalizePosSaleInErp(order.id, ctx.orgId, { payments: input.payments })
          await order.reload()
          const contact = order.contact_id ? await Contact.findByPk(order.contact_id) : null
          const receiver = contact ?? CF_CONTACT
          const items = await SalesOrderItem.findAll({ where: { order_id: order.id } })
          const lineItems: AfipLineItem[] = items.map((i) => ({
            iva_rate: i.iva_rate,
            tax_base: i.tax_base,
            tax_amount: i.tax_amount,
          }))
          const req = buildPosFECAERequest({
            org,
            contact: receiver,
            items: lineItems,
            issueDate: order.issue_date ?? input.sold_at,
            puntoVenta: order.punto_venta,
            cbteNumero: order.cbte_numero,
            cbteTipo: order.comprobante_tipo as CbteTipo,
          })
          return orderToFiscalResult(order, buildQrUrl(org, req, order.cbte_numero, order.cae))
        } catch (err) {
          if (isAfipCbteUniqueViolation(err)) {
            logger.warn({ orderId: order.id, err }, 'pos afip cbte collision on finalize — re-issuing CAE')
            shouldReissueCae = true
          } else {
            const message = err instanceof Error ? err.message : String(err)
            logger.error({ orderId: order.id, err: message }, 'pos sale ERP finalize failed (existing CAE)')
            throw new Error('POS_SALE_FINALIZE_ERROR')
          }
        }
      }
    } else {
      try {
        await finalizePosSaleInErp(order.id, ctx.orgId, { payments: input.payments })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error({ orderId: order.id, err: message }, 'pos sale ERP finalize failed (existing invoice)')
        throw new Error('POS_SALE_FINALIZE_ERROR')
      }
      await order.reload()
      const contact = order.contact_id ? await Contact.findByPk(order.contact_id) : null
      const receiver = contact ?? CF_CONTACT
      const items = await SalesOrderItem.findAll({ where: { order_id: order.id } })
      const lineItems: AfipLineItem[] = items.map((i) => ({
        iva_rate: i.iva_rate,
        tax_base: i.tax_base,
        tax_amount: i.tax_amount,
      }))
      const req = buildPosFECAERequest({
        org,
        contact: receiver,
        items: lineItems,
        issueDate: order.issue_date ?? input.sold_at,
        puntoVenta: order.punto_venta,
        cbteNumero: order.cbte_numero,
        cbteTipo: order.comprobante_tipo as CbteTipo,
      })
      return orderToFiscalResult(order, buildQrUrl(org, req, order.cbte_numero, order.cae))
    }

    if (shouldReissueCae) {
      await clearOrderFiscalFields(order)
    }
  }

  const [branch, device, posConfig] = await Promise.all([
    ctx.branchId ? Branch.findByPk(ctx.branchId) : Promise.resolve(null),
    PosDevice.findByPk(ctx.deviceRowId),
    getPosConfig(ctx.orgId),
  ])
  if (!branch) throw new Error('BRANCH_NOT_FOUND')

  const puntoVenta = device?.punto_venta ?? branch.punto_venta ?? null
  if (!puntoVenta) throw new Error('AFIP_PUNTO_VENTA_REQUIRED')

  const contact = order.contact_id ? await Contact.findByPk(order.contact_id) : null
  const receiver = contact ?? CF_CONTACT

  const items = await SalesOrderItem.findAll({ where: { order_id: order.id } })
  const lineItems: AfipLineItem[] = items.map((i) => ({
    iva_rate: i.iva_rate,
    tax_base: i.tax_base,
    tax_amount: i.tax_amount,
  }))

  const cbteTipo = resolvePosCbteTipo(org.iva_condition, receiver.iva_condition, posConfig.ticket?.comprobante_codigo)
  const wsfe = deps.wsfe ?? (await getAfipClients(ctx.orgId)).wsfe

  const cbteNumero = await resolveNextCbteNumero(ctx.orgId, wsfe, puntoVenta, cbteTipo)
  const issueDate = order.issue_date ?? input.sold_at.slice(0, 10)

  const req = buildPosFECAERequest({
    org,
    contact: receiver,
    items: lineItems,
    issueDate,
    puntoVenta,
    cbteNumero,
    cbteTipo,
  })

  const emission = await AfipEmission.create({
    org_id: ctx.orgId,
    document_type: 'sales_order',
    document_id: order.id,
    cbte_tipo: req.cbteTipo,
    punto_venta: puntoVenta,
    status: 'pending',
    request: req as unknown as Record<string, unknown>,
    last_attempt_at: new Date(),
  })

  logger.info(
    { orderId: order.id, posSaleId: input.pos_sale_id, cbteTipo: req.cbteTipo, puntoVenta, cbteNumero },
    'pos afip CAE request started',
  )

  try {
    const result = await wsfe.solicitarCAE(req)
    const fiscalTicketNumber = formatFiscalTicketNumber(puntoVenta, cbteNumero)

    if (result.resultado === FE_RESULT.APROBADO && result.cae) {
      const qrUrl = buildQrUrl(org, req, cbteNumero, result.cae)
      await sequelize.transaction(async (t) => {
        await order.update(
          {
            fiscal_ticket_number: fiscalTicketNumber,
            cae: result.cae,
            cae_expiration: result.caeVto ? parseAfipDate(result.caeVto) : null,
            comprobante_tipo: req.cbteTipo,
            punto_venta: puntoVenta,
            cbte_numero: cbteNumero,
            afip_status: 'authorized',
            afip_observations: result.observations,
            issue_date: issueDate,
          },
          { transaction: t },
        )
        await emission.update(
          {
            status: 'authorized',
            response: result as unknown as Record<string, unknown>,
            observations: result.observations,
          },
          { transaction: t },
        )
      })
      await order.reload()
      logger.info({ orderId: order.id, cae: result.cae, cbteNumero }, 'pos afip CAE authorized')

      try {
        await finalizePosSaleInErp(order.id, ctx.orgId, { payments: input.payments })
      } catch (finalizeErr) {
        const message = finalizeErr instanceof Error ? finalizeErr.message : String(finalizeErr)
        logger.error({ orderId: order.id, err: message }, 'pos sale ERP finalize failed after CAE')
        throw new Error('POS_SALE_FINALIZE_ERROR')
      }

      await order.reload()
      return orderToFiscalResult(order, qrUrl)
    }

    await sequelize.transaction(async (t) => {
      await order.update({ afip_status: 'rejected', afip_observations: result.observations }, { transaction: t })
      await emission.update(
        {
          status: 'rejected',
          response: result as unknown as Record<string, unknown>,
          observations: result.observations,
        },
        { transaction: t },
      )
    })
    await order.reload()
    throw new Error('AFIP_CAE_REJECTED')
  } catch (err) {
    if (err instanceof Error && (err.message === 'AFIP_CAE_REJECTED' || err.message === 'POS_SALE_FINALIZE_ERROR')) {
      throw err
    }
    const message = err instanceof Error ? err.message : String(err)
    await order.reload()
    if (!order.cae) {
      await order.update({ afip_status: 'contingency' })
      await emission.update({ status: 'error', error: message, retries: (emission.retries ?? 0) + 1 })
    }
    logger.error({ orderId: order.id, err: message }, 'pos afip CAE transport error')
    throw new Error('AFIP_CAE_TRANSPORT_ERROR')
  }
}
