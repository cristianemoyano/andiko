import 'server-only'
import logger from '@/lib/logger'
import EmailLog from '@/modules/communications/email-log.model'
import { getResolvedEmailSettings } from '@/modules/communications/email-settings.service'
import { getEffectiveEmailTemplates } from '@/modules/communications/email-templates.service'
import {
  plainTextToHtml,
  renderEmailTemplate,
  renderTemplateString,
  type EmailDocumentType,
  type EmailTemplateContext,
} from '@/modules/communications/email-template.schema'
import { buildTransport } from '@/modules/communications/transport'
import { documentSharedPayloadSchema } from '../notification.schema'
import type { NotificationChannelAdapter, ChannelDeliveryContext, ChannelDeliveryResult } from './types'

function resolveDocumentEmailContent(
  documentType: EmailDocumentType,
  payload: Record<string, unknown>,
  subjectOverride: string | null | undefined,
  bodyOverride: string | null | undefined,
  orgId: string,
): Promise<{ subject: string; body: string; html: string }> {
  const parsed = documentSharedPayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error('INVALID_DOCUMENT_PAYLOAD')
  }
  const doc = parsed.data
  const templateCtx: EmailTemplateContext = {
    contact_name: doc.contact_name,
    document_number: doc.document_number,
    document_label: doc.document_label,
    total: doc.total,
    org_name: doc.org_name,
    document_url: doc.document_url,
  }

  return getEffectiveEmailTemplates(orgId).then((templates) => {
    const fallback = templates[documentType]
    let subject: string
    let body: string
    if (subjectOverride != null || bodyOverride != null) {
      subject = renderTemplateString(subjectOverride ?? fallback.subject, templateCtx)
      body = renderTemplateString(bodyOverride ?? fallback.body, templateCtx)
    } else {
      const rendered = renderEmailTemplate(fallback, templateCtx)
      subject = rendered.subject
      body = rendered.body
    }
    return { subject, body, html: plainTextToHtml(body) }
  })
}

export class EmailChannelAdapter implements NotificationChannelAdapter {
  readonly kind = 'email' as const

  async deliver(ctx: ChannelDeliveryContext): Promise<ChannelDeliveryResult> {
    const { notification, delivery, transaction } = ctx
    const payload = notification.payload
    const overrides = payload._overrides as { subject?: string | null; body?: string | null } | undefined

    if (notification.event_key !== 'sales.document.shared') {
      return { status: 'skipped', error: 'Evento no soportado por canal email' }
    }

    const documentType = payload.document_type as EmailDocumentType
    const to = notification.recipient_address
    if (!to) {
      return { status: 'failed', error: 'Destinatario de email requerido' }
    }

    let subject: string
    let body: string
    let html: string
    try {
      const rendered = await resolveDocumentEmailContent(
        documentType,
        payload,
        overrides?.subject,
        overrides?.body,
        notification.org_id,
      )
      subject = rendered.subject
      body = rendered.body
      html = rendered.html
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al renderizar template'
      return { status: 'failed', error: message }
    }

    const settings = await getResolvedEmailSettings()
    const transport = buildTransport(settings)

    const emailLogBase = {
      org_id: notification.org_id,
      document_domain: String(payload.document_domain),
      document_type: String(payload.document_type),
      document_id: String(payload.document_id),
      recipient: to,
      subject,
      body_text: body,
      body_html: html,
      sent_by: notification.actor_id,
      notification_delivery_id: delivery.id,
    }

    try {
      const result = await transport.send({ to, subject, text: body, html })
      const log = await EmailLog.create(
        {
          ...emailLogBase,
          status: 'sent',
          error: null,
          transport: result.transport,
          message_id: result.messageId,
        },
        { transaction },
      )
      logger.info(
        {
          orgId: notification.org_id,
          notificationId: notification.id,
          deliveryId: delivery.id,
          documentType,
          transport: result.transport,
        },
        'Notification email delivered',
      )
      return {
        status: 'sent',
        subject,
        body_text: body,
        body_html: html,
        transport: result.transport,
        message_id: result.messageId,
        email_log_id: log.id,
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      const log = await EmailLog.create(
        {
          ...emailLogBase,
          status: 'failed',
          error: message.slice(0, 1000),
          transport: transport.kind,
          message_id: null,
        },
        { transaction },
      )
      logger.error(
        {
          orgId: notification.org_id,
          notificationId: notification.id,
          deliveryId: delivery.id,
          err: message,
        },
        'Notification email delivery failed',
      )
      return {
        status: 'failed',
        subject,
        body_text: body,
        body_html: html,
        transport: transport.kind,
        error: message,
        email_log_id: log.id,
      }
    }
  }
}
