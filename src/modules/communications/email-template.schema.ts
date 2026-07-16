import { z } from 'zod'

/**
 * Email templates for every email the ERP sends. Stored as a JSONB blob on
 * `organization_settings.email_templates`; defaults live here in code and are
 * merged with any per-org overrides on read.
 *
 * Keys split into two families:
 * - Document types: "share this document with a contact" (manual send button).
 * - System keys: automatic emails triggered by a business event.
 */

export const EMAIL_DOCUMENT_TYPES = ['quote', 'order', 'invoice', 'delivery_note', 'purchase_order'] as const
export type EmailDocumentType = (typeof EMAIL_DOCUMENT_TYPES)[number]

export const SYSTEM_EMAIL_TEMPLATE_KEYS = [
  'payment_receipt',
  'user_welcome',
  'password_reset',
  'low_stock_alert',
] as const
export type SystemEmailTemplateKey = (typeof SYSTEM_EMAIL_TEMPLATE_KEYS)[number]

export const EMAIL_TEMPLATE_KEYS = [...EMAIL_DOCUMENT_TYPES, ...SYSTEM_EMAIL_TEMPLATE_KEYS] as const
export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number]

/**
 * System keys the org manager can turn on/off (automatic business emails).
 * Manual document sends and `password_reset` (platform/security flow) are
 * intentionally not toggleable.
 */
export const EMAIL_TEMPLATE_TOGGLEABLE_KEYS = ['payment_receipt', 'user_welcome', 'low_stock_alert'] as const
export type ToggleableEmailTemplateKey = (typeof EMAIL_TEMPLATE_TOGGLEABLE_KEYS)[number]

export const EMAIL_DOCUMENT_LABEL: Record<EmailDocumentType, string> = {
  quote: 'Presupuesto',
  order: 'Pedido',
  invoice: 'Factura',
  delivery_note: 'Remito',
  purchase_order: 'Orden de compra',
}

export const EMAIL_SYSTEM_TEMPLATE_LABEL: Record<SystemEmailTemplateKey, string> = {
  payment_receipt: 'Recibo de pago',
  user_welcome: 'Bienvenida de usuario',
  password_reset: 'Restablecer contraseña',
  low_stock_alert: 'Alerta de stock bajo',
}

export const EMAIL_TEMPLATE_LABEL: Record<EmailTemplateKey, string> = {
  ...EMAIL_DOCUMENT_LABEL,
  ...EMAIL_SYSTEM_TEMPLATE_LABEL,
}

/** Variables available for interpolation per key, for the editor help text. */
export const EMAIL_TEMPLATE_VARIABLES: Record<EmailTemplateKey, readonly string[]> = {
  quote: ['contact_name', 'document_number', 'document_label', 'total', 'org_name', 'document_url'],
  order: ['contact_name', 'document_number', 'document_label', 'total', 'org_name', 'document_url'],
  invoice: ['contact_name', 'document_number', 'document_label', 'total', 'org_name', 'document_url'],
  delivery_note: ['contact_name', 'document_number', 'document_label', 'total', 'org_name', 'document_url'],
  purchase_order: ['contact_name', 'document_number', 'document_label', 'total', 'org_name', 'document_url'],
  payment_receipt: [
    'contact_name', 'org_name', 'invoice_number', 'payment_number', 'amount', 'payment_date', 'document_url',
  ],
  user_welcome: ['user_name', 'org_name', 'login_url'],
  password_reset: ['user_name', 'org_name', 'reset_url'],
  low_stock_alert: [
    'product_name', 'variant_name', 'warehouse_name', 'quantity', 'minimum_quantity', 'org_name', 'document_url',
  ],
}

export const emailTemplateEntrySchema = z.object({
  subject: z.string().min(1, 'El asunto es obligatorio').max(500),
  body: z.string().min(1, 'El cuerpo es obligatorio').max(20_000),
})
export type EmailTemplateEntry = z.infer<typeof emailTemplateEntrySchema>

/** Same shape plus an on/off switch, used by the 3 toggleable system keys. */
export const toggleableEmailTemplateEntrySchema = emailTemplateEntrySchema.extend({
  enabled: z.boolean().default(true),
})
export type ToggleableEmailTemplateEntry = z.infer<typeof toggleableEmailTemplateEntrySchema>

/** Full templates object (canonical, persisted shape). */
export const emailTemplatesSchema = z.object({
  quote: emailTemplateEntrySchema,
  order: emailTemplateEntrySchema,
  invoice: emailTemplateEntrySchema,
  delivery_note: emailTemplateEntrySchema,
  purchase_order: emailTemplateEntrySchema,
  payment_receipt: toggleableEmailTemplateEntrySchema,
  user_welcome: toggleableEmailTemplateEntrySchema,
  password_reset: emailTemplateEntrySchema,
  low_stock_alert: toggleableEmailTemplateEntrySchema,
}).strict()
export type EmailTemplates = z.infer<typeof emailTemplatesSchema>

/** Partial update — org may submit a subset of the keys. */
export const emailTemplatesUpdateSchema = z.object({
  quote: emailTemplateEntrySchema.optional(),
  order: emailTemplateEntrySchema.optional(),
  invoice: emailTemplateEntrySchema.optional(),
  delivery_note: emailTemplateEntrySchema.optional(),
  purchase_order: emailTemplateEntrySchema.optional(),
  payment_receipt: toggleableEmailTemplateEntrySchema.optional(),
  user_welcome: toggleableEmailTemplateEntrySchema.optional(),
  password_reset: emailTemplateEntrySchema.optional(),
  low_stock_alert: toggleableEmailTemplateEntrySchema.optional(),
}).strict()
export type EmailTemplatesUpdateInput = z.infer<typeof emailTemplatesUpdateSchema>

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplates = {
  quote: {
    subject: '{{org_name}} — Presupuesto {{document_number}}',
    body: [
      'Hola {{contact_name}},',
      '',
      'Te enviamos el presupuesto {{document_number}} por un total de {{total}}.',
      '',
      'Podés verlo en el siguiente enlace: {{document_url}}',
      '',
      'Quedamos a disposición ante cualquier consulta.',
      '',
      'Saludos,',
      '{{org_name}}',
    ].join('\n'),
  },
  order: {
    subject: '{{org_name}} — Pedido {{document_number}}',
    body: [
      'Hola {{contact_name}},',
      '',
      'Confirmamos la recepción de tu pedido {{document_number}} por un total de {{total}}.',
      '',
      'Podés verlo en el siguiente enlace: {{document_url}}',
      '',
      'Saludos,',
      '{{org_name}}',
    ].join('\n'),
  },
  invoice: {
    subject: '{{org_name}} — Factura {{document_number}}',
    body: [
      'Hola {{contact_name}},',
      '',
      'Adjuntamos la factura {{document_number}} por un total de {{total}}.',
      '',
      'Podés verla en el siguiente enlace: {{document_url}}',
      '',
      'Gracias por tu compra.',
      '',
      'Saludos,',
      '{{org_name}}',
    ].join('\n'),
  },
  delivery_note: {
    subject: '{{org_name}} — Remito {{document_number}}',
    body: [
      'Hola {{contact_name}},',
      '',
      'Te enviamos el remito {{document_number}} correspondiente a tu entrega.',
      '',
      'Podés verlo en el siguiente enlace: {{document_url}}',
      '',
      'Saludos,',
      '{{org_name}}',
    ].join('\n'),
  },
  purchase_order: {
    subject: '{{org_name}} — Orden de compra {{document_number}}',
    body: [
      'Hola {{contact_name}},',
      '',
      'Te enviamos la orden de compra {{document_number}} por un total de {{total}}.',
      '',
      'Podés verla en el siguiente enlace: {{document_url}}',
      '',
      'Saludos,',
      '{{org_name}}',
    ].join('\n'),
  },
  payment_receipt: {
    subject: '{{org_name}} — Recibo de pago {{payment_number}}',
    body: [
      'Hola {{contact_name}},',
      '',
      'Registramos tu pago de {{amount}} con fecha {{payment_date}}, correspondiente a la factura {{invoice_number}}.',
      '',
      'Podés ver el detalle en el siguiente enlace: {{document_url}}',
      '',
      '¡Gracias!',
      '',
      'Saludos,',
      '{{org_name}}',
    ].join('\n'),
    enabled: true,
  },
  user_welcome: {
    subject: 'Bienvenido a {{org_name}}',
    body: [
      'Hola {{user_name}},',
      '',
      'Tu cuenta en {{org_name}} ya está lista. Ingresá con tu email y la contraseña que te compartió tu administrador:',
      '',
      '{{login_url}}',
      '',
      'Saludos,',
      '{{org_name}}',
    ].join('\n'),
    enabled: true,
  },
  password_reset: {
    subject: 'Restablecer tu contraseña — {{org_name}}',
    body: [
      'Hola {{user_name}},',
      '',
      'Recibimos un pedido para restablecer tu contraseña en {{org_name}}. Si fuiste vos, hacé clic en el siguiente enlace para elegir una nueva:',
      '',
      '{{reset_url}}',
      '',
      'Si no fuiste vos, podés ignorar este mensaje.',
      '',
      'Saludos,',
      '{{org_name}}',
    ].join('\n'),
  },
  low_stock_alert: {
    subject: '{{org_name}} — Stock bajo: {{product_name}}',
    body: [
      'Hola,',
      '',
      'El producto {{product_name}} ({{variant_name}}) en el depósito {{warehouse_name}} tiene stock por debajo del mínimo: {{quantity}} unidades (mínimo {{minimum_quantity}}).',
      '',
      'Revisá la reposición en el siguiente enlace: {{document_url}}',
      '',
      'Saludos,',
      '{{org_name}}',
    ].join('\n'),
    enabled: true,
  },
}

/**
 * Merge a (possibly partial / persisted) blob over the defaults. Each key
 * that is missing or invalid falls back to its default entry.
 */
export function mergeEmailTemplates(stored: unknown): EmailTemplates {
  const base: Record<string, unknown> = structuredClone(DEFAULT_EMAIL_TEMPLATES)
  if (stored && typeof stored === 'object') {
    const parsed = emailTemplatesUpdateSchema.safeParse(stored)
    if (parsed.success) {
      for (const key of EMAIL_TEMPLATE_KEYS) {
        const entry = parsed.data[key]
        if (entry) base[key] = entry
      }
    }
  }
  return base as EmailTemplates
}

/** Variables passed to the renderer. Each caller builds the subset it needs. */
export type EmailTemplateContext = Record<string, string>

const VARIABLE_PATTERN = /\{\{\s*([a-z_]+)\s*\}\}/g

/** Interpolate `{{var}}` placeholders. Unknown variables are left untouched. */
export function renderTemplateString(template: string, ctx: EmailTemplateContext): string {
  return template.replace(VARIABLE_PATTERN, (match, key: string) => {
    if (key in ctx) return ctx[key]
    return match
  })
}

export interface RenderedEmail {
  subject: string
  body: string
}

export function renderEmailTemplate(entry: EmailTemplateEntry, ctx: EmailTemplateContext): RenderedEmail {
  return {
    subject: renderTemplateString(entry.subject, ctx),
    body: renderTemplateString(entry.body, ctx),
  }
}

/** Convert a plain-text body (with newlines) into a minimal HTML body. */
export function plainTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const withLinks = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => `<a href="${url}">${url}</a>`,
  )
  return `<div style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;color:#18181b;line-height:1.6">${withLinks.replace(/\n/g, '<br/>')}</div>`
}
