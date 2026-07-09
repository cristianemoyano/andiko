import 'server-only'
import logger from '@/lib/logger'
import { getResolvedEmailSettings } from './email-settings.service'
import { andikoMailSenderMismatchMessage } from './smtp-options'
import { buildTransport } from './transport'

export interface SendTestEmailResult {
  transport: 'smtp' | 'log'
  messageId: string | null
  recipient: string
}

/** Error thrown when SMTP is not enabled/configured at the platform level. */
export const SMTP_NOT_CONFIGURED = 'SMTP_NOT_CONFIGURED'
/** Error thrown when the SMTP server rejected/failed the delivery. */
export const EMAIL_TEST_FAILED = 'EMAIL_TEST_FAILED'

function buildTestEmail(now: Date) {
  const stamp = now.toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })
  const subject = 'Andiko · Email de prueba'
  const text = [
    'Este es un email de prueba enviado desde la configuración SMTP de Andiko.',
    'Si lo recibiste, la configuración del servidor de correo funciona correctamente.',
    '',
    `Enviado: ${stamp}`,
  ].join('\n')
  const html = `<!doctype html>
<html lang="es"><body style="margin:0;background:#F7FBFC;font-family:'Geist',-apple-system,BlinkMacSystemFont,sans-serif;color:#18181B;">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px;">
    <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:20px;">
      <span style="display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:7px;background:#0C647A;">
        <span style="color:#fff;font-weight:600;font-size:15px;">A</span>
      </span>
      <span style="font-weight:600;font-size:19px;letter-spacing:-0.02em;color:#18181B;">andiko</span>
    </div>
    <div style="background:#fff;border:1px solid #E4E4E7;border-radius:12px;padding:28px;">
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#18181B;">Email de prueba</h1>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#52525B;">
        Este es un email de prueba enviado desde la configuración SMTP de Andiko.
        Si lo recibiste, la configuración del servidor de correo funciona correctamente.
      </p>
      <p style="margin:0;font-size:12px;color:#A1A1AA;">Enviado: ${stamp}</p>
    </div>
  </div>
</body></html>`
  return { subject, text, html }
}

/**
 * Send a test email using the SAVED platform SMTP settings. Throws
 * `SMTP_NOT_CONFIGURED` when SMTP is not enabled/configured, and
 * `EMAIL_TEST_FAILED` (with a `detail` string) when the SMTP server rejects it.
 * Not recorded in `email_logs` — that table is for per-org document sends.
 */
export async function sendTestEmail(to: string): Promise<SendTestEmailResult> {
  const settings = await getResolvedEmailSettings()
  if (!settings) throw new Error(SMTP_NOT_CONFIGURED)

  const senderError = andikoMailSenderMismatchMessage(
    settings.host,
    settings.user,
    settings.from_address,
  )
  if (senderError) {
    const wrapped = new Error(EMAIL_TEST_FAILED) as Error & { detail?: string }
    wrapped.detail = senderError
    throw wrapped
  }

  const transport = buildTransport(settings)
  const { subject, text, html } = buildTestEmail(new Date())

  try {
    const result = await transport.send({ to, subject, text, html })
    logger.info({ to, transport: result.transport }, 'SMTP test email sent')
    return { transport: result.transport, messageId: result.messageId, recipient: to }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    logger.error({ to, err: message }, 'SMTP test email failed')
    const wrapped = new Error(EMAIL_TEST_FAILED) as Error & { detail?: string }
    wrapped.detail = message
    throw wrapped
  }
}
