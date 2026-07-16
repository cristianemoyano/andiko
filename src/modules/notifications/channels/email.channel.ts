import 'server-only'
import logger from '@/lib/logger'
import EmailLog from '@/modules/communications/email-log.model'
import { getResolvedEmailSettings } from '@/modules/communications/email-settings.service'
import { getEffectiveEmailTemplates } from '@/modules/communications/email-templates.service'
import {
  plainTextToHtml,
  renderEmailTemplate,
  renderTemplateString,
  type EmailTemplateKey,
} from '@/modules/communications/email-template.schema'
import { buildTransport } from '@/modules/communications/transport'
import {
  documentSharedPayloadSchema,
  paymentReceiptPayloadSchema,
  userWelcomePayloadSchema,
  passwordResetPayloadSchema,
  lowStockAlertPayloadSchema,
  type NotificationEventKey,
} from '../notification.schema'
import type { NotificationChannelAdapter, ChannelDeliveryContext, ChannelDeliveryResult } from './types'

/** What an event resolver extracts from a notification's payload, ready to render + log. */
interface EmailEventResolution {
  templateKey: EmailTemplateKey
  ctx: Record<string, string>
  documentDomain: string
  documentType: string
  documentId: string
}

function resolveDocumentSharedContent(payload: Record<string, unknown>): EmailEventResolution {
  const parsed = documentSharedPayloadSchema.safeParse(payload)
  if (!parsed.success) throw new Error('INVALID_DOCUMENT_PAYLOAD')
  const doc = parsed.data
  return {
    templateKey: doc.document_type,
    ctx: {
      contact_name: doc.contact_name,
      document_number: doc.document_number,
      document_label: doc.document_label,
      total: doc.total,
      org_name: doc.org_name,
      document_url: doc.document_url,
    },
    documentDomain: doc.document_domain,
    documentType: doc.document_type,
    documentId: doc.document_id,
  }
}

function resolvePaymentReceiptContent(payload: Record<string, unknown>): EmailEventResolution {
  const parsed = paymentReceiptPayloadSchema.safeParse(payload)
  if (!parsed.success) throw new Error('INVALID_PAYMENT_RECEIPT_PAYLOAD')
  const data = parsed.data
  return {
    templateKey: 'payment_receipt',
    ctx: {
      contact_name: data.contact_name,
      org_name: data.org_name,
      invoice_number: data.invoice_number,
      payment_number: data.payment_number,
      amount: data.amount,
      payment_date: data.payment_date,
      document_url: data.document_url,
    },
    documentDomain: 'sales',
    documentType: 'payment',
    documentId: data.payment_id,
  }
}

function resolveUserWelcomeContent(payload: Record<string, unknown>): EmailEventResolution {
  const parsed = userWelcomePayloadSchema.safeParse(payload)
  if (!parsed.success) throw new Error('INVALID_USER_WELCOME_PAYLOAD')
  const data = parsed.data
  return {
    templateKey: 'user_welcome',
    ctx: { user_name: data.user_name, org_name: data.org_name, login_url: data.login_url },
    documentDomain: 'auth',
    documentType: 'user',
    documentId: data.user_id,
  }
}

function resolvePasswordResetContent(payload: Record<string, unknown>): EmailEventResolution {
  const parsed = passwordResetPayloadSchema.safeParse(payload)
  if (!parsed.success) throw new Error('INVALID_PASSWORD_RESET_PAYLOAD')
  const data = parsed.data
  return {
    templateKey: 'password_reset',
    ctx: { user_name: data.user_name, org_name: data.org_name, reset_url: data.reset_url },
    documentDomain: 'auth',
    documentType: 'user',
    documentId: data.user_id,
  }
}

function resolveLowStockAlertContent(payload: Record<string, unknown>): EmailEventResolution {
  const parsed = lowStockAlertPayloadSchema.safeParse(payload)
  if (!parsed.success) throw new Error('INVALID_LOW_STOCK_ALERT_PAYLOAD')
  const data = parsed.data
  return {
    templateKey: 'low_stock_alert',
    ctx: {
      product_name: data.product_name,
      variant_name: data.variant_name,
      warehouse_name: data.warehouse_name,
      quantity: data.quantity,
      minimum_quantity: data.minimum_quantity,
      org_name: data.org_name,
      document_url: data.document_url,
    },
    documentDomain: 'inventory',
    documentType: 'stock_item',
    documentId: data.stock_item_id,
  }
}

/** One resolver per supported event key — add here when a new event needs email delivery. */
const EVENT_RESOLVERS: Record<NotificationEventKey, (payload: Record<string, unknown>) => EmailEventResolution> = {
  'sales.document.shared': resolveDocumentSharedContent,
  'sales.payment_receipt': resolvePaymentReceiptContent,
  'auth.user_welcome': resolveUserWelcomeContent,
  'auth.password_reset': resolvePasswordResetContent,
  'inventory.stock_low': resolveLowStockAlertContent,
}

interface ResolvedEmailContent {
  subject: string
  body: string
  html: string
  documentDomain: string
  documentType: string
  documentId: string
}

async function resolveEmailContent(
  eventKey: NotificationEventKey,
  payload: Record<string, unknown>,
  subjectOverride: string | null | undefined,
  bodyOverride: string | null | undefined,
  orgId: string,
): Promise<ResolvedEmailContent> {
  const resolution = EVENT_RESOLVERS[eventKey](payload)

  const templates = await getEffectiveEmailTemplates(orgId)
  const fallback = templates[resolution.templateKey]
  let subject: string
  let body: string
  if (subjectOverride != null || bodyOverride != null) {
    subject = renderTemplateString(subjectOverride ?? fallback.subject, resolution.ctx)
    body = renderTemplateString(bodyOverride ?? fallback.body, resolution.ctx)
  } else {
    const rendered = renderEmailTemplate(fallback, resolution.ctx)
    subject = rendered.subject
    body = rendered.body
  }
  return {
    subject,
    body,
    html: plainTextToHtml(body),
    documentDomain: resolution.documentDomain,
    documentType: resolution.documentType,
    documentId: resolution.documentId,
  }
}

export class EmailChannelAdapter implements NotificationChannelAdapter {
  readonly kind = 'email' as const

  async deliver(ctx: ChannelDeliveryContext): Promise<ChannelDeliveryResult> {
    const { notification, delivery, transaction } = ctx
    const payload = notification.payload
    const overrides = payload._overrides as { subject?: string | null; body?: string | null } | undefined

    const eventKey = notification.event_key as NotificationEventKey
    if (!(eventKey in EVENT_RESOLVERS)) {
      return { status: 'skipped', error: 'Evento no soportado por canal email' }
    }

    const to = notification.recipient_address
    if (!to) {
      return { status: 'failed', error: 'Destinatario de email requerido' }
    }

    let subject: string
    let body: string
    let html: string
    let documentDomain: string
    let documentType: string
    let documentId: string
    try {
      const rendered = await resolveEmailContent(
        eventKey,
        payload,
        overrides?.subject,
        overrides?.body,
        notification.org_id,
      )
      subject = rendered.subject
      body = rendered.body
      html = rendered.html
      documentDomain = rendered.documentDomain
      documentType = rendered.documentType
      documentId = rendered.documentId
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al renderizar template'
      return { status: 'failed', error: message }
    }

    const settings = await getResolvedEmailSettings()
    const transport = buildTransport(settings)

    const emailLogBase = {
      org_id: notification.org_id,
      document_domain: documentDomain,
      document_type: documentType,
      document_id: documentId,
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
          eventKey,
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
