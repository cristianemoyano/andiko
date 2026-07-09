import 'server-only'
import type { Transaction } from 'sequelize'
import type { NotificationChannel } from '../notification.schema'
import type NotificationDelivery from '../notification-delivery.model'
import type Notification from '../notification.model'

export interface ChannelDeliveryContext {
  notification: Notification
  delivery: NotificationDelivery
  transaction?: Transaction
}

export interface ChannelDeliveryResult {
  status: 'sent' | 'failed' | 'skipped'
  subject?: string | null
  body_text?: string | null
  body_html?: string | null
  transport?: string | null
  message_id?: string | null
  error?: string | null
  /** Legacy email_logs row id when channel mirrors to email_logs. */
  email_log_id?: string | null
}

export interface NotificationChannelAdapter {
  readonly kind: NotificationChannel
  deliver(ctx: ChannelDeliveryContext): Promise<ChannelDeliveryResult>
}
