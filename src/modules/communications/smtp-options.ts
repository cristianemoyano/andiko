import type { EmailSettings } from './email-settings.schema'

/** TLS SNI hostname when connecting to the Swarm service name (cert is for mail.andiko.cloud). */
export const ANDIKO_MAIL_TLS_SERVERNAME = 'mail.andiko.cloud'

/** Map internal SMTP hostnames to the certificate SAN used by docker-mailserver. */
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
