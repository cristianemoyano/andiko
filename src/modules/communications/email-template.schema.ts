import { z } from 'zod'

/**
 * Email templates per sales document type. Stored as a JSONB blob on
 * `organization_settings.email_templates`; defaults live here in code and are
 * merged with any per-org overrides on read.
 *
 * Supported interpolation variables (see `EMAIL_TEMPLATE_VARIABLES`):
 *   {{contact_name}}, {{document_number}}, {{document_label}}, {{total}},
 *   {{org_name}}, {{document_url}}
 */

export const EMAIL_DOCUMENT_TYPES = ['quote', 'order', 'invoice', 'delivery_note'] as const
export type EmailDocumentType = (typeof EMAIL_DOCUMENT_TYPES)[number]

export const EMAIL_DOCUMENT_LABEL: Record<EmailDocumentType, string> = {
  quote: 'Presupuesto',
  order: 'Pedido',
  invoice: 'Factura',
  delivery_note: 'Remito',
}

/** Variables available for interpolation, for the editor help text. */
export const EMAIL_TEMPLATE_VARIABLES = [
  'contact_name',
  'document_number',
  'document_label',
  'total',
  'org_name',
  'document_url',
] as const
export type EmailTemplateVariable = (typeof EMAIL_TEMPLATE_VARIABLES)[number]

export const emailTemplateEntrySchema = z.object({
  subject: z.string().min(1, 'El asunto es obligatorio').max(500),
  body: z.string().min(1, 'El cuerpo es obligatorio').max(20_000),
})
export type EmailTemplateEntry = z.infer<typeof emailTemplateEntrySchema>

const templatesShape = Object.fromEntries(
  EMAIL_DOCUMENT_TYPES.map((t) => [t, emailTemplateEntrySchema]),
) as Record<EmailDocumentType, typeof emailTemplateEntrySchema>

/** Full templates object (canonical, persisted shape). */
export const emailTemplatesSchema = z.object(templatesShape).strict()
export type EmailTemplates = z.infer<typeof emailTemplatesSchema>

const templatesUpdateShape = Object.fromEntries(
  EMAIL_DOCUMENT_TYPES.map((t) => [t, emailTemplateEntrySchema.optional()]),
) as Record<EmailDocumentType, z.ZodOptional<typeof emailTemplateEntrySchema>>

/** Partial update — org may submit a subset of document types. */
export const emailTemplatesUpdateSchema = z.object(templatesUpdateShape).strict()
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
}

/**
 * Merge a (possibly partial / persisted) blob over the defaults. Each document
 * type that is missing or invalid falls back to its default entry.
 */
export function mergeEmailTemplates(stored: unknown): EmailTemplates {
  const base: EmailTemplates = structuredClone(DEFAULT_EMAIL_TEMPLATES)
  if (!stored || typeof stored !== 'object') return base
  const parsed = emailTemplatesUpdateSchema.safeParse(stored)
  if (!parsed.success) return base
  for (const type of EMAIL_DOCUMENT_TYPES) {
    const entry = parsed.data[type]
    if (entry) base[type] = entry
  }
  return base
}

/** Variables passed to the renderer. */
export interface EmailTemplateContext {
  contact_name: string
  document_number: string
  document_label: string
  total: string
  org_name: string
  document_url: string
}

const VARIABLE_PATTERN = /\{\{\s*([a-z_]+)\s*\}\}/g

/** Interpolate `{{var}}` placeholders. Unknown variables are left untouched. */
export function renderTemplateString(template: string, ctx: EmailTemplateContext): string {
  return template.replace(VARIABLE_PATTERN, (match, key: string) => {
    if (key in ctx) return ctx[key as keyof EmailTemplateContext]
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
