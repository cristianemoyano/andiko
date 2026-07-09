import { z } from 'zod'

export const NOTIFICATION_CHANNELS = ['email', 'in_app', 'push'] as const
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

export const NOTIFICATION_DELIVERY_STATUSES = ['pending', 'sent', 'failed', 'skipped'] as const
export type NotificationDeliveryStatus = (typeof NOTIFICATION_DELIVERY_STATUSES)[number]

export const NOTIFICATION_RECIPIENT_KINDS = ['user', 'contact', 'email'] as const
export type NotificationRecipientKind = (typeof NOTIFICATION_RECIPIENT_KINDS)[number]

/** Canonical notification events. Extend as new modules emit notifications. */
export const NOTIFICATION_EVENT_KEYS = [
  'sales.document.shared',
] as const
export type NotificationEventKey = (typeof NOTIFICATION_EVENT_KEYS)[number]

export const documentSharedPayloadSchema = z.object({
  document_type: z.enum(['quote', 'order', 'invoice', 'delivery_note']),
  document_id: z.string().uuid(),
  document_domain: z.enum(['sales', 'inventory']),
  document_number: z.string().min(1),
  document_label: z.string().min(1),
  contact_name: z.string().min(1),
  total: z.string().min(1),
  org_name: z.string().min(1),
  document_url: z.string().url(),
})
export type DocumentSharedPayload = z.infer<typeof documentSharedPayloadSchema>

const recipientUserSchema = z.object({
  kind: z.literal('user'),
  userId: z.string().uuid(),
})

const recipientContactSchema = z.object({
  kind: z.literal('contact'),
  contactId: z.string().uuid(),
  address: z.string().email().max(320).optional(),
})

const recipientEmailSchema = z.object({
  kind: z.literal('email'),
  address: z.string().email().max(320),
})

export const notificationRecipientSchema = z.discriminatedUnion('kind', [
  recipientUserSchema,
  recipientContactSchema,
  recipientEmailSchema,
])
export type NotificationRecipient = z.infer<typeof notificationRecipientSchema>

export const emitNotificationSchema = z.object({
  eventKey: z.enum(NOTIFICATION_EVENT_KEYS),
  recipient: notificationRecipientSchema,
  payload: z.record(z.string(), z.unknown()),
  channels: z.array(z.enum(NOTIFICATION_CHANNELS)).min(1),
  subjectOverride: z.string().max(500).nullable().optional(),
  bodyOverride: z.string().max(20_000).nullable().optional(),
})
export type EmitNotificationInput = z.infer<typeof emitNotificationSchema>

export interface EmitNotificationResult {
  notification_id: string
  deliveries: Array<{
    id: string
    channel: NotificationChannel
    status: NotificationDeliveryStatus
    transport: string | null
    error: string | null
  }>
  /** Primary delivery for backward-compatible email responses. */
  primary_delivery_id: string | null
  status: 'sent' | 'failed'
  transport: 'smtp' | 'log' | null
  recipient: string | null
  subject: string | null
  log_id: string | null
}
