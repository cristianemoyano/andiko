import 'server-only'
import type { NotificationChannelAdapter, ChannelDeliveryContext, ChannelDeliveryResult } from './types'

/** In-app notifications are persisted as the notification row itself. */
export class InAppChannelAdapter implements NotificationChannelAdapter {
  readonly kind = 'in_app' as const

  async deliver(ctx: ChannelDeliveryContext): Promise<ChannelDeliveryResult> {
    const { notification } = ctx
    const title = typeof notification.payload.title === 'string' ? notification.payload.title : null
    const body = typeof notification.payload.body === 'string' ? notification.payload.body : null

    if (!title && !body) {
      return { status: 'skipped', error: 'Payload in-app incompleto' }
    }

    return {
      status: 'sent',
      subject: title,
      body_text: body,
      transport: 'internal',
    }
  }
}
