import 'server-only'
import type { TenantContext } from '@/lib/tenancy'
import Contact from '@/modules/contacts/contact.model'
import { getQuote } from '@/modules/sales/sales-quotes.service'
import { getOrder } from '@/modules/sales/sales-orders.service'
import { getInvoice } from '@/modules/sales/invoices.service'
import { getDeliveryNote } from '@/modules/inventory/delivery-notes.service'
import { getIssuerName } from '@/modules/printing/issuer'
import { env } from '@/config/env'
import { EMAIL_DOCUMENT_LABEL, type EmailDocumentType } from './email-template.schema'

/** Resolved facts about a document needed to build & send an email. */
export interface ResolvedDocument {
  document_type: EmailDocumentType
  document_id: string
  document_number: string
  document_label: string
  total: string
  org_name: string
  /** Best-effort recipient from the linked contact; may be null. */
  contact_email: string | null
  contact_name: string
  /** Absolute print URL for the document. */
  document_url: string
}

function decToString(v: unknown): string {
  if (v == null) return '0.00'
  return String(v)
}

function formatArs(v: unknown): string {
  const n = Number(decToString(v))
  if (Number.isNaN(n)) return decToString(v)
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

const PRINT_PATH: Record<EmailDocumentType, (id: string) => string> = {
  quote: (id) => `/ventas/presupuestos/${id}/print`,
  order: (id) => `/ventas/pedidos/${id}/print`,
  invoice: (id) => `/ventas/facturas/${id}/print`,
  delivery_note: (id) => `/inventario/remitos/${id}/print`,
}

function absoluteUrl(path: string): string {
  const base = env.AUTH_URL.replace(/\/$/, '')
  return `${base}${path}`
}

async function resolveContact(contactId: string | null, orgId: string): Promise<{ email: string | null; name: string }> {
  if (!contactId) return { email: null, name: 'Cliente' }
  const contact = await Contact.findOne({
    where: { id: contactId, org_id: orgId },
    attributes: ['id', 'legal_name', 'trade_name', 'email'],
  })
  if (!contact) return { email: null, name: 'Cliente' }
  return { email: contact.email ?? null, name: contact.trade_name || contact.legal_name }
}

export async function resolveDocument(
  documentType: EmailDocumentType,
  documentId: string,
  ctx: TenantContext,
): Promise<ResolvedDocument> {
  const orgName = await getIssuerName(ctx.orgId)
  const label = EMAIL_DOCUMENT_LABEL[documentType]
  const url = absoluteUrl(PRINT_PATH[documentType](documentId))

  let number: string
  let total: string
  let contactId: string | null

  switch (documentType) {
    case 'quote': {
      const doc = (await getQuote(documentId, ctx)) as unknown as { quote_number: string; total: unknown; contact_id: string | null }
      number = doc.quote_number
      total = formatArs(doc.total)
      contactId = doc.contact_id ?? null
      break
    }
    case 'order': {
      const doc = (await getOrder(documentId, ctx)) as unknown as { order_number: string; total: unknown; contact_id: string | null }
      number = doc.order_number
      total = formatArs(doc.total)
      contactId = doc.contact_id ?? null
      break
    }
    case 'invoice': {
      const doc = (await getInvoice(documentId, ctx)) as unknown as { invoice_number: string; total: unknown; contact_id: string | null }
      number = doc.invoice_number
      total = formatArs(doc.total)
      contactId = doc.contact_id ?? null
      break
    }
    case 'delivery_note': {
      const doc = (await getDeliveryNote(documentId, ctx.orgId)) as unknown as { delivery_number: string; contact_id: string | null }
      number = doc.delivery_number
      total = formatArs(0)
      contactId = doc.contact_id ?? null
      break
    }
  }

  const contact = await resolveContact(contactId, ctx.orgId)

  return {
    document_type: documentType,
    document_id: documentId,
    document_number: number,
    document_label: label,
    total,
    org_name: orgName,
    contact_email: contact.email,
    contact_name: contact.name,
    document_url: url,
  }
}
