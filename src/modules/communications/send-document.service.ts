import 'server-only'
import type { TenantContext } from '@/lib/tenancy'
import logger from '@/lib/logger'
import EmailLog, { type EmailLogStatus } from './email-log.model'
import { resolveDocument } from './document-resolver'
import { getResolvedEmailSettings } from './email-settings.service'
import { getEffectiveEmailTemplates } from './email-templates.service'
import {
  plainTextToHtml,
  renderTemplateString,
  renderEmailTemplate,
  type EmailDocumentType,
  type EmailTemplateContext,
} from './email-template.schema'
import { buildTransport } from './transport'

/** email_logs.document_domain per document type (module that owns the record). */
const DOCUMENT_DOMAIN: Record<EmailDocumentType, string> = {
  quote: 'sales',
  order: 'sales',
  invoice: 'sales',
  delivery_note: 'inventory',
}

export interface SendDocumentEmailInput {
  documentType: EmailDocumentType
  documentId: string
  /** Recipient address. Required — the caller confirms/edits the contact's email. */
  to: string
  /** Optional subject/body overrides; when present they are still interpolated. */
  subjectOverride?: string | null
  bodyOverride?: string | null
}

export interface SendDocumentEmailResult {
  status: EmailLogStatus
  transport: 'smtp' | 'log'
  recipient: string
  subject: string
  log_id: string
}

/**
 * Resolve a document, render the configured email template (or the provided
 * overrides), send it through the org's SMTP transport (or the log transport
 * when SMTP is not configured), and persist an `email_logs` row in every case.
 *
 * A delivery failure is recorded as a `failed` log and re-thrown as
 * `EMAIL_SEND_FAILED` so the route can surface it to the user.
 */
export async function sendDocumentEmail(
  input: SendDocumentEmailInput,
  ctx: TenantContext,
  actorId: string | null,
): Promise<SendDocumentEmailResult> {
  // Resolving also enforces tenant ownership: the getters throw *_NOT_FOUND
  // when the document does not belong to the caller's org.
  const doc = await resolveDocument(input.documentType, input.documentId, ctx)

  const templateCtx: EmailTemplateContext = {
    contact_name: doc.contact_name,
    document_number: doc.document_number,
    document_label: doc.document_label,
    total: doc.total,
    org_name: doc.org_name,
    document_url: doc.document_url,
  }

  let subject: string
  let body: string
  if (input.subjectOverride != null || input.bodyOverride != null) {
    const templates = await getEffectiveEmailTemplates(ctx.orgId)
    const fallback = templates[input.documentType]
    subject = renderTemplateString(input.subjectOverride ?? fallback.subject, templateCtx)
    body = renderTemplateString(input.bodyOverride ?? fallback.body, templateCtx)
  } else {
    const templates = await getEffectiveEmailTemplates(ctx.orgId)
    const rendered = renderEmailTemplate(templates[input.documentType], templateCtx)
    subject = rendered.subject
    body = rendered.body
  }

  const settings = await getResolvedEmailSettings()
  const transport = buildTransport(settings)

  const base = {
    org_id: ctx.orgId,
    document_domain: DOCUMENT_DOMAIN[input.documentType],
    document_type: input.documentType,
    document_id: input.documentId,
    recipient: input.to,
    subject,
    sent_by: actorId,
  }

  try {
    const result = await transport.send({
      to: input.to,
      subject,
      text: body,
      html: plainTextToHtml(body),
    })
    const log = await EmailLog.create({ ...base, status: 'sent', error: null })
    logger.info(
      { orgId: ctx.orgId, documentType: input.documentType, documentId: input.documentId, transport: result.transport },
      'Document email sent',
    )
    return {
      status: 'sent',
      transport: result.transport,
      recipient: input.to,
      subject,
      log_id: log.id,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    const log = await EmailLog.create({ ...base, status: 'failed', error: message.slice(0, 1000) })
    logger.error(
      { orgId: ctx.orgId, documentType: input.documentType, documentId: input.documentId, err: message },
      'Document email send failed',
    )
    const wrapped = new Error('EMAIL_SEND_FAILED')
    ;(wrapped as Error & { detail?: string; logId?: string }).detail = message
    ;(wrapped as Error & { detail?: string; logId?: string }).logId = log.id
    throw wrapped
  }
}
