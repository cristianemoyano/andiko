import 'server-only'
import PlatformSetting from '@/modules/auth/platform-setting.model'
import { decryptSecret, encryptSecret, isEncryptedSecret } from '@/lib/crypto'
import {
  emailSettingsSchema,
  type EmailSettings,
  type EmailSettingsUpdateInput,
  type PublicEmailSettings,
} from './email-settings.schema'
import { andikoMailSenderMismatchMessage } from './smtp-options'

export class EmailSettingsValidationError extends Error {
  readonly code = 'VALIDATION_ERROR' as const
  constructor(message: string) {
    super(message)
    this.name = 'EmailSettingsValidationError'
  }
}

/**
 * Global (platform-wide) SMTP configuration, managed by sys-admin and stored in
 * the singleton `platform_settings` row. The password is encrypted at rest and
 * NEVER returned to the client — GET responses expose only `has_password`.
 */

/** Load the singleton row, creating it on first access. */
async function getRow(): Promise<PlatformSetting> {
  const existing = await PlatformSetting.findOne({ where: { singleton: true } })
  if (existing) return existing
  return PlatformSetting.create({ singleton: true })
}

function toPublic(row: PlatformSetting): PublicEmailSettings {
  return {
    enabled: row.smtp_enabled,
    host: row.smtp_host,
    port: row.smtp_port,
    secure: row.smtp_secure,
    user: row.smtp_user,
    from_name: row.from_name,
    from_address: row.from_address,
    has_password: row.smtp_password_encrypted.length > 0,
  }
}

/** Client-safe view: never includes the password. */
export async function getPublicEmailSettings(): Promise<PublicEmailSettings> {
  return toPublic(await getRow())
}

/**
 * Resolved settings for the transport, including the decrypted password.
 * Returns null when SMTP is not configured/enabled, so callers fall back to the
 * log transport. Server-only — never expose this to the client.
 */
export async function getResolvedEmailSettings(): Promise<EmailSettings | null> {
  const row = await getRow()
  if (!row.smtp_enabled || !row.smtp_host || !row.from_address) return null
  const password = row.smtp_password_encrypted ? (decryptSecret(row.smtp_password_encrypted) ?? '') : ''
  const parsed = emailSettingsSchema.safeParse({
    enabled: row.smtp_enabled,
    host: row.smtp_host,
    port: row.smtp_port,
    secure: row.smtp_secure,
    user: row.smtp_user,
    password,
    from_name: row.from_name,
    from_address: row.from_address,
  })
  return parsed.success ? parsed.data : null
}

/**
 * Persist a partial settings update onto the singleton row. The password is
 * encrypted before storage; an omitted/empty password keeps the existing one.
 * Returns the redacted public view.
 */
export async function updateEmailSettings(
  input: EmailSettingsUpdateInput,
): Promise<PublicEmailSettings> {
  const row = await getRow()

  let smtp_password_encrypted = row.smtp_password_encrypted
  if (typeof input.password === 'string' && input.password.length > 0) {
    // Defensive: never double-encrypt if the client somehow echoes a blob back.
    smtp_password_encrypted = isEncryptedSecret(input.password)
      ? input.password
      : encryptSecret(input.password)
  }

  const mergedHost = input.host ?? row.smtp_host
  const mergedUser = input.user ?? row.smtp_user
  const mergedFrom = input.from_address ?? row.from_address
  const senderError = andikoMailSenderMismatchMessage(mergedHost, mergedUser, mergedFrom)
  if (senderError) throw new EmailSettingsValidationError(senderError)

  await row.update({
    smtp_enabled: input.enabled ?? row.smtp_enabled,
    smtp_host: input.host ?? row.smtp_host,
    smtp_port: input.port ?? row.smtp_port,
    smtp_secure: input.secure ?? row.smtp_secure,
    smtp_user: input.user ?? row.smtp_user,
    smtp_password_encrypted,
    from_name: input.from_name ?? row.from_name,
    from_address: input.from_address ?? row.from_address,
  })

  return toPublic(row)
}
