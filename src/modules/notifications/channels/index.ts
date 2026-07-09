import 'server-only'
import type { NotificationChannelAdapter } from './types'
import { EmailChannelAdapter } from './email.channel'
import { InAppChannelAdapter } from './in-app.channel'

const emailChannel = new EmailChannelAdapter()
const inAppChannel = new InAppChannelAdapter()

const CHANNELS: Record<string, NotificationChannelAdapter> = {
  email: emailChannel,
  in_app: inAppChannel,
}

export function getChannelAdapter(kind: string): NotificationChannelAdapter | null {
  return CHANNELS[kind] ?? null
}

export { EmailChannelAdapter, InAppChannelAdapter }
