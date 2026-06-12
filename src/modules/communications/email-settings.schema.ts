import { z } from 'zod'

/**
 * Per-organization SMTP configuration, stored as a JSONB blob on
 * `organization_settings.email_settings`. The password is encrypted at rest
 * (see `email-settings.service.ts`) and NEVER returned to the client — GET
 * responses expose only `has_password: boolean`.
 */

export const emailSettingsSchema = z.object({
  enabled: z.boolean(),
  host: z.string().min(1, 'El servidor SMTP es obligatorio').max(255),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  user: z.string().max(320),
  /** Plaintext on write only; stored encrypted, never returned. */
  password: z.string().max(1024),
  from_name: z.string().min(1, 'El nombre del remitente es obligatorio').max(255),
  from_address: z.string().email('Dirección de correo inválida').max(320),
})
export type EmailSettings = z.infer<typeof emailSettingsSchema>

/**
 * Update payload from the client. Every field optional; `password` is special:
 * - omitted / empty string → keep the existing password
 * - non-empty string → replace the password
 */
export const emailSettingsUpdateSchema = z
  .object({
    enabled: z.boolean().optional(),
    host: z.string().max(255).optional(),
    port: z.number().int().min(1).max(65535).optional(),
    secure: z.boolean().optional(),
    user: z.string().max(320).optional(),
    password: z.string().max(1024).optional(),
    from_name: z.string().max(255).optional(),
    from_address: z.string().email('Dirección de correo inválida').max(320).optional().or(z.literal('')),
  })
  .strict()
export type EmailSettingsUpdateInput = z.infer<typeof emailSettingsUpdateSchema>

/** Shape returned to the client — password redacted to a boolean flag. */
export interface PublicEmailSettings {
  enabled: boolean
  host: string
  port: number
  secure: boolean
  user: string
  from_name: string
  from_address: string
  has_password: boolean
}

export const DEFAULT_EMAIL_SETTINGS: PublicEmailSettings = {
  enabled: false,
  host: '',
  port: 587,
  secure: false,
  user: '',
  from_name: '',
  from_address: '',
  has_password: false,
}
