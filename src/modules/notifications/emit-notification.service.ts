import 'server-only'
import type { Transaction } from 'sequelize'
import logger from '@/lib/logger'
import Notification from './notification.model'
import NotificationDelivery from './notification-delivery.model'
import {
  emitNotificationSchema,
  type EmitNotificationInput,
  type EmitNotificationResult,
  type NotificationChannel,
  type NotificationRecipient,
} from './notification.schema'
import { getChannelAdapter } from './channels'

export interface EmitNotificationOptions {
  orgId: string
  actorId: string | null
  transaction?: Transaction
}

function recipientToRow(recipient: NotificationRecipient): Pick<
  Notification,
  'recipient_kind' | 'recipient_user_id' | 'recipient_contact_id' | 'recipient_address'
> {
  switch (recipient.kind) {
    case 'user':
      return {
        recipient_kind: 'user',
        recipient_user_id: recipient.userId,
        recipient_contact_id: null,
        recipient_address: null,
      }
    case 'contact':
      return {
        recipient_kind: 'contact',
        recipient_user_id: null,
        recipient_contact_id: recipient.contactId,
        recipient_address: recipient.address ?? null,
      }
    case 'email':
      return {
        recipient_kind: 'email',
        recipient_user_id: null,
        recipient_contact_id: null,
        recipient_address: recipient.address,
      }
  }
}

/**
 * Create a notification and deliver it through the requested channels.
 * Failures on individual channels are recorded on notification_deliveries;
 * throws EMAIL_SEND_FAILED when the primary email channel fails.
 */
export async function emitNotification(
  input: EmitNotificationInput,
  options: EmitNotificationOptions,
): Promise<EmitNotificationResult> {
  const parsed = emitNotificationSchema.parse(input)
  const { orgId, actorId, transaction } = options

  const payload = { ...parsed.payload }
  if (parsed.subjectOverride != null || parsed.bodyOverride != null) {
    payload._overrides = {
      subject: parsed.subjectOverride ?? null,
      body: parsed.bodyOverride ?? null,
    }
  }

  const notification = await Notification.create(
    {
      org_id: orgId,
      event_key: parsed.eventKey,
      actor_id: actorId,
      ...recipientToRow(parsed.recipient),
      payload,
    },
    { transaction },
  )

  const deliveryResults: EmitNotificationResult['deliveries'] = []
  let primaryEmail: {
    deliveryId: string
    status: 'sent' | 'failed'
    transport: 'smtp' | 'log' | null
    subject: string | null
    recipient: string | null
    logId: string | null
    error: string | null
  } | null = null

  for (const channel of parsed.channels) {
    const delivery = await NotificationDelivery.create(
      {
        notification_id: notification.id,
        org_id: orgId,
        channel,
        status: 'pending',
      },
      { transaction },
    )

    const adapter = getChannelAdapter(channel)
    if (!adapter) {
      await delivery.update(
        { status: 'skipped', error: `Canal no implementado: ${channel}` },
        { transaction },
      )
      deliveryResults.push({
        id: delivery.id,
        channel,
        status: 'skipped',
        transport: null,
        error: `Canal no implementado: ${channel}`,
      })
      continue
    }

    const result = await adapter.deliver({ notification, delivery, transaction })
    const deliveredAt = result.status === 'sent' ? new Date() : null

    await delivery.update(
      {
        status: result.status,
        subject: result.subject ?? null,
        body_text: result.body_text ?? null,
        body_html: result.body_html ?? null,
        transport: result.transport ?? null,
        message_id: result.message_id ?? null,
        error: result.error?.slice(0, 1000) ?? null,
        delivered_at: deliveredAt,
      },
      { transaction },
    )

    deliveryResults.push({
      id: delivery.id,
      channel,
      status: result.status,
      transport: result.transport ?? null,
      error: result.error ?? null,
    })

    if (channel === 'email') {
      primaryEmail = {
        deliveryId: delivery.id,
        status: result.status === 'sent' ? 'sent' : 'failed',
        transport: (result.transport === 'smtp' || result.transport === 'log' ? result.transport : null),
        subject: result.subject ?? null,
        recipient: notification.recipient_address,
        logId: result.email_log_id ?? null,
        error: result.error ?? null,
      }
    }
  }

  logger.info(
    { orgId, notificationId: notification.id, eventKey: parsed.eventKey, channels: parsed.channels },
    'Notification emitted',
  )

  const overallStatus = primaryEmail?.status ?? (
    deliveryResults.some((d) => d.status === 'sent') ? 'sent' : 'failed'
  )

  if (primaryEmail?.status === 'failed') {
    const wrapped = new Error('EMAIL_SEND_FAILED')
    ;(wrapped as Error & { detail?: string; logId?: string }).detail = primaryEmail.error ?? undefined
    ;(wrapped as Error & { detail?: string; logId?: string }).logId = primaryEmail.logId ?? undefined
    throw wrapped
  }

  return {
    notification_id: notification.id,
    deliveries: deliveryResults,
    primary_delivery_id: primaryEmail?.deliveryId ?? null,
    status: overallStatus,
    transport: primaryEmail?.transport ?? null,
    recipient: primaryEmail?.recipient ?? null,
    subject: primaryEmail?.subject ?? null,
    log_id: primaryEmail?.logId ?? null,
  }
}

export function resolveChannelsForEvent(
  eventKey: string,
  explicit?: NotificationChannel[],
): NotificationChannel[] {
  if (explicit && explicit.length > 0) return explicit
  if (eventKey === 'sales.document.shared') return ['email']
  return ['in_app']
}
