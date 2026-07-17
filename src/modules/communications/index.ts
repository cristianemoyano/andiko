// Communications module — per-org email configuration, document email templates,
// and sending documents (presupuesto/pedido/factura/remito) to contacts.

export {
  EMAIL_DOCUMENT_TYPES,
  EMAIL_DOCUMENT_LABEL,
  EMAIL_TEMPLATE_KEYS,
  SYSTEM_EMAIL_TEMPLATE_KEYS,
  EMAIL_TEMPLATE_TOGGLEABLE_KEYS,
  EMAIL_TEMPLATE_LABEL,
  EMAIL_TEMPLATE_VARIABLES,
  type EmailDocumentType,
  type EmailTemplateKey,
  type SystemEmailTemplateKey,
} from './email-template.schema'

export {
  emailSettingsUpdateSchema,
  emailTestSchema,
  DEFAULT_EMAIL_SETTINGS,
  type PublicEmailSettings,
  type EmailTestInput,
} from './email-settings.schema'
export { getPublicEmailSettings, updateEmailSettings } from './email-settings.service'
export {
  sendTestEmail,
  SMTP_NOT_CONFIGURED,
  EMAIL_TEST_FAILED,
  type SendTestEmailResult,
} from './send-test.service'

export {
  emailTemplatesUpdateSchema,
  DEFAULT_EMAIL_TEMPLATES,
  type EmailTemplates,
} from './email-template.schema'
export { getEffectiveEmailTemplates, updateEmailTemplates } from './email-templates.service'

export { sendDocumentEmail, type SendDocumentEmailResult } from './send-document.service'
export {
  listDocumentEmailLogs,
  listEmailLogs,
  getEmailLog,
  getEmailLogDocumentHref,
  type EmailLogView,
  type EmailLogListItem,
  type EmailLogDetail,
} from './email-logs.service'
export { emailLogListQuerySchema, type EmailLogListQuery } from './email-logs.schema'
