import type { EmailSettings } from './email-settings.schema'

/** TLS SNI hostname when connecting to the Swarm service name (cert is for mail.andiko.cloud). */
export const ANDIKO_MAIL_TLS_SERVERNAME = 'mail.andiko.cloud'

const ANDIKO_MAIL_HOSTS = new Set(['mailserver', 'mail.andiko.cloud'])

export function isAndikoMailHost(host: string): boolean {
  return ANDIKO_MAIL_HOSTS.has(host.trim().toLowerCase())
}

/** docker-mailserver with SPOOF_PROTECTION requires From to match the SMTP auth user. */
export function andikoMailSenderMismatchMessage(
  host: string,
  user: string,
  fromAddress: string,
): string | null {
  if (!isAndikoMailHost(host)) return null
  const authUser = user.trim().toLowerCase()
  const from = fromAddress.trim().toLowerCase()
  if (!authUser || !from || authUser === from) return null
  return `Con Servidor Andiko, el email del remitente debe ser el mismo que el usuario SMTP (${user.trim()}).`
}

export function resolveSmtpTlsServername(host: string): string | undefined {
  if (host.trim().toLowerCase() === 'mailserver') return ANDIKO_MAIL_TLS_SERVERNAME
  return undefined
}

export function buildSmtpTransportOptions(settings: EmailSettings) {
  const tlsServername = resolveSmtpTlsServername(settings.host)
  return {
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: settings.user
      ? { user: settings.user, pass: settings.password }
      : undefined,
    ...(tlsServername ? { tls: { servername: tlsServername } } : {}),
  }
}
