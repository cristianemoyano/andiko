import 'server-only'
import nodemailer from 'nodemailer'
import logger from '@/lib/logger'
import { buildSmtpTransportOptions } from './smtp-options'
import type { EmailSettings } from './email-settings.schema'

export interface OutgoingEmail {
  to: string
  subject: string
  html: string
  text: string
}

export interface SendResult {
  transport: 'smtp' | 'log'
  messageId: string | null
}

export interface EmailTransport {
  readonly kind: 'smtp' | 'log'
  send(email: OutgoingEmail): Promise<SendResult>
}

/** Dev/fallback transport: logs the email instead of sending it. */
class LogTransport implements EmailTransport {
  readonly kind = 'log' as const
  async send(email: OutgoingEmail): Promise<SendResult> {
    logger.info(
      { to: email.to, subject: email.subject, transport: 'log' },
      'Email transport not configured — logging email instead of sending',
    )
    return { transport: 'log', messageId: null }
  }
}

class SmtpTransport implements EmailTransport {
  readonly kind = 'smtp' as const
  private readonly settings: EmailSettings

  constructor(settings: EmailSettings) {
    this.settings = settings
  }

  async send(email: OutgoingEmail): Promise<SendResult> {
    const transporter = nodemailer.createTransport(buildSmtpTransportOptions(this.settings))
    const info = await transporter.sendMail({
      from: { name: this.settings.from_name, address: this.settings.from_address },
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    })
    return { transport: 'smtp', messageId: info.messageId ?? null }
  }
}

/**
 * Build the transport for an org. When SMTP is configured & enabled, returns an
 * SMTP transport; otherwise a log transport so sends never hard-fail in dev.
 */
export function buildTransport(settings: EmailSettings | null): EmailTransport {
  if (settings) return new SmtpTransport(settings)
  return new LogTransport()
}
