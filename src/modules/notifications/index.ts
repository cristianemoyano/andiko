// Notifications module — unified event emission with channel adapters (email, in_app, push).

export {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENT_KEYS,
  NOTIFICATION_DELIVERY_STATUSES,
  NOTIFICATION_RECIPIENT_KINDS,
  documentSharedPayloadSchema,
  emitNotificationSchema,
  type NotificationChannel,
  type NotificationEventKey,
  type NotificationDeliveryStatus,
  type NotificationRecipient,
  type NotificationRecipientKind,
  type DocumentSharedPayload,
  type EmitNotificationInput,
  type EmitNotificationResult,
} from './notification.schema'

export { emitNotification, resolveChannelsForEvent } from './emit-notification.service'
export {
  sendDocumentNotification,
  type SendDocumentNotificationInput,
  type SendDocumentNotificationResult,
} from './document-notification.service'
