import 'server-only'
import OrganizationSetting from '@/modules/auth/organization-setting.model'
import { decryptSecret, encryptSecret, isEncryptedSecret } from '@/lib/crypto'
import {
  DEFAULT_EMAIL_SETTINGS,
  emailSettingsSchema,
  type EmailSettings,
  type EmailSettingsUpdateInput,
  type PublicEmailSettings,
} from './email-settings.schema'

/** Full stored shape (password encrypted). */
interface StoredEmailSettings {
  enabled: boolean
  host: string
  port: number
  secure: boolean
  user: string
  /** Encrypted blob, or '' when no password is configured. */
  password_encrypted: string
  from_name: string
  from_address: string
}

function parseStored(raw: unknown): StoredEmailSettings | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : false,
    host: typeof r.host === 'string' ? r.host : '',
    port: typeof r.port === 'number' ? r.port : 587,
    secure: typeof r.secure === 'boolean' ? r.secure : false,
    user: typeof r.user === 'string' ? r.user : '',
    password_encrypted: typeof r.password_encrypted === 'string' ? r.password_encrypted : '',
    from_name: typeof r.from_name === 'string' ? r.from_name : '',
    from_address: typeof r.from_address === 'string' ? r.from_address : '',
  }
}

function toPublic(stored: StoredEmailSettings | null): PublicEmailSettings {
  if (!stored) return { ...DEFAULT_EMAIL_SETTINGS }
  return {
    enabled: stored.enabled,
    host: stored.host,
    port: stored.port,
    secure: stored.secure,
    user: stored.user,
    from_name: stored.from_name,
    from_address: stored.from_address,
    has_password: stored.password_encrypted.length > 0,
  }
}

/** Client-safe view: never includes the password. */
export async function getPublicEmailSettings(orgId: string): Promise<PublicEmailSettings> {
  const row = await OrganizationSetting.findOne({ where: { org_id: orgId }, attributes: ['email_settings'] })
  return toPublic(parseStored(row?.email_settings ?? null))
}

/**
 * Resolved settings for the transport, including the decrypted password.
 * Returns null when SMTP is not configured/enabled, so callers fall back to the
 * log transport. Server-only — never expose this to the client.
 */
export async function getResolvedEmailSettings(orgId: string): Promise<EmailSettings | null> {
  const row = await OrganizationSetting.findOne({ where: { org_id: orgId }, attributes: ['email_settings'] })
  const stored = parseStored(row?.email_settings ?? null)
  if (!stored || !stored.enabled || !stored.host || !stored.from_address) return null
  const password = stored.password_encrypted ? (decryptSecret(stored.password_encrypted) ?? '') : ''
  const candidate = {
    enabled: stored.enabled,
    host: stored.host,
    port: stored.port,
    secure: stored.secure,
    user: stored.user,
    password,
    from_name: stored.from_name,
    from_address: stored.from_address,
  }
  const parsed = emailSettingsSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}

/**
 * Persist a partial settings update. Merges over the current stored settings.
 * The password is encrypted before storage; an omitted/empty password keeps the
 * existing one. Returns the redacted public view.
 */
export async function updateEmailSettings(
  orgId: string,
  input: EmailSettingsUpdateInput,
): Promise<PublicEmailSettings> {
  const existing = await OrganizationSetting.findOne({ where: { org_id: orgId } })
  const current = parseStored(existing?.email_settings ?? null) ?? {
    enabled: false,
    host: '',
    port: 587,
    secure: false,
    user: '',
    password_encrypted: '',
    from_name: '',
    from_address: '',
  }

  let password_encrypted = current.password_encrypted
  if (typeof input.password === 'string' && input.password.length > 0) {
    // Defensive: never double-encrypt if the client somehow echoes a blob back.
    password_encrypted = isEncryptedSecret(input.password)
      ? input.password
      : encryptSecret(input.password)
  }

  const next: StoredEmailSettings = {
    enabled: input.enabled ?? current.enabled,
    host: input.host ?? current.host,
    port: input.port ?? current.port,
    secure: input.secure ?? current.secure,
    user: input.user ?? current.user,
    password_encrypted,
    from_name: input.from_name ?? current.from_name,
    from_address: input.from_address ?? current.from_address,
  }

  const stored = next as unknown as Record<string, unknown>
  if (existing) {
    await existing.update({ email_settings: stored })
  } else {
    await OrganizationSetting.create({ org_id: orgId, email_settings: stored })
  }

  return toPublic(next)
}
