import 'server-only'
import { Op } from 'sequelize'
import EmailLog, { type EmailLogStatus, type EmailLogTransport } from './email-log.model'
import {
  EMAIL_DOCUMENT_LABEL,
  EMAIL_DOCUMENT_TYPES,
  type EmailDocumentType,
} from './email-template.schema'
import type { EmailLogListQuery } from './email-logs.schema'
import { paginate, toPaginated } from '@/lib/pagination'

const MAX_DOCUMENT_LOGS = 50

export interface EmailLogView {
  id: string
  recipient: string
  subject: string
  status: EmailLogStatus
  error: string | null
  sent_at: string
}

export interface EmailLogListItem extends EmailLogView {
  document_type: EmailDocumentType
  document_id: string
  document_label: string
  document_number: string | null
  transport: EmailLogTransport | null
}

export interface EmailLogDetail extends EmailLogListItem {
  body_text: string | null
  body_html: string | null
  message_id: string | null
  sent_by: string | null
}

const DETAIL_PATH: Record<EmailDocumentType, (id: string) => string> = {
  quote: (id) => `/ventas/presupuestos/${id}`,
  order: (id) => `/ventas/pedidos/${id}`,
  invoice: (id) => `/ventas/facturas/${id}`,
  delivery_note: (id) => `/inventario/remitos/${id}`,
}

function isEmailDocumentType(value: string): value is EmailDocumentType {
  return (EMAIL_DOCUMENT_TYPES as readonly string[]).includes(value)
}

function extractDocumentNumber(subject: string): string | null {
  const match = subject.match(/(?:Presupuesto|Pedido|Factura|Remito)\s+(\S+)/i)
  return match?.[1] ?? null
}

function toListItem(row: EmailLog): EmailLogListItem {
  const documentType = isEmailDocumentType(row.document_type) ? row.document_type : 'invoice'
  return {
    id: row.id,
    recipient: row.recipient,
    subject: row.subject,
    status: row.status,
    error: row.error,
    sent_at: row.created_at.toISOString(),
    document_type: documentType,
    document_id: row.document_id,
    document_label: EMAIL_DOCUMENT_LABEL[documentType],
    document_number: extractDocumentNumber(row.subject),
    transport: row.transport,
  }
}

function toDetail(row: EmailLog): EmailLogDetail {
  return {
    ...toListItem(row),
    body_text: row.body_text,
    body_html: row.body_html,
    message_id: row.message_id,
    sent_by: row.sent_by,
  }
}

/** Send history for a single document, newest first. */
export async function listDocumentEmailLogs(
  orgId: string,
  documentType: EmailDocumentType,
  documentId: string,
): Promise<EmailLogView[]> {
  const rows = await EmailLog.findAll({
    where: { org_id: orgId, document_type: documentType, document_id: documentId },
    order: [['created_at', 'DESC']],
    limit: MAX_DOCUMENT_LOGS,
  })
  return rows.map((r) => ({
    id: r.id,
    recipient: r.recipient,
    subject: r.subject,
    status: r.status,
    error: r.error,
    sent_at: r.created_at.toISOString(),
  }))
}

export interface ListEmailLogsInput extends EmailLogListQuery {
  allowedDocumentTypes: EmailDocumentType[]
}

/** Paginated org-wide email log for audit. Filters to document types the caller may read. */
export async function listEmailLogs(orgId: string, input: ListEmailLogsInput) {
  const { page, limit, search, status, document_type, allowedDocumentTypes } = input
  const { offset } = paginate(page, limit)

  const typeFilter =
    document_type && allowedDocumentTypes.includes(document_type)
      ? [document_type]
      : allowedDocumentTypes

  if (typeFilter.length === 0) {
    return toPaginated<EmailLogListItem>([], 0, page, limit)
  }

  const where: Record<string, unknown> = {
    org_id: orgId,
    document_type: { [Op.in]: typeFilter },
  }
  if (status) where.status = status
  if (search?.trim()) {
    const q = `%${search.trim()}%`
    where[Op.or as unknown as string] = [
      { recipient: { [Op.iLike]: q } },
      { subject: { [Op.iLike]: q } },
    ]
  }

  const { rows, count } = await EmailLog.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit,
    offset,
  })

  return toPaginated(rows.map(toListItem), count, page, limit)
}

/** Full log detail for audit view. Throws EMAIL_LOG_NOT_FOUND when missing or out of scope. */
export async function getEmailLog(
  orgId: string,
  logId: string,
  allowedDocumentTypes: EmailDocumentType[],
): Promise<EmailLogDetail> {
  const row = await EmailLog.findOne({ where: { id: logId, org_id: orgId } })
  if (!row || !isEmailDocumentType(row.document_type)) {
    throw new Error('EMAIL_LOG_NOT_FOUND')
  }
  if (!allowedDocumentTypes.includes(row.document_type)) {
    throw new Error('EMAIL_LOG_NOT_FOUND')
  }
  return toDetail(row)
}

export function getEmailLogDocumentHref(documentType: EmailDocumentType, documentId: string): string {
  return DETAIL_PATH[documentType](documentId)
}
