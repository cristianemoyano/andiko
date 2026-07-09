import { describe, expect, it } from 'vitest'
import {
  ANDIKO_MAIL_TLS_SERVERNAME,
  andikoMailSenderMismatchMessage,
  buildSmtpTransportOptions,
  resolveSmtpTlsServername,
} from './smtp-options'
import type { EmailSettings } from './email-settings.schema'

const baseSettings: EmailSettings = {
  enabled: true,
  host: 'smtp.example.com',
  port: 587,
  secure: false,
  user: 'user@example.com',
  password: 'secret',
  from_name: 'Test',
  from_address: 'user@example.com',
}

describe('resolveSmtpTlsServername', () => {
  it('maps internal Swarm hostname mailserver to mail.andiko.cloud', () => {
    expect(resolveSmtpTlsServername('mailserver')).toBe(ANDIKO_MAIL_TLS_SERVERNAME)
    expect(resolveSmtpTlsServername('  MailServer  ')).toBe(ANDIKO_MAIL_TLS_SERVERNAME)
  })

  it('returns undefined for external SMTP hosts', () => {
    expect(resolveSmtpTlsServername('mail.andiko.cloud')).toBeUndefined()
    expect(resolveSmtpTlsServername('smtp.gmail.com')).toBeUndefined()
  })
})

describe('andikoMailSenderMismatchMessage', () => {
  it('requires from_address to match SMTP user on Andiko mail hosts', () => {
    expect(
      andikoMailSenderMismatchMessage('mailserver', 'erp@andiko.cloud', 'gmail@gmail.com'),
    ).toContain('erp@andiko.cloud')
    expect(
      andikoMailSenderMismatchMessage('mail.andiko.cloud', 'erp@andiko.cloud', 'erp@andiko.cloud'),
    ).toBeNull()
  })

  it('does not apply to external SMTP hosts', () => {
    expect(
      andikoMailSenderMismatchMessage('smtp.gmail.com', 'a@gmail.com', 'b@gmail.com'),
    ).toBeNull()
  })
})

describe('buildSmtpTransportOptions', () => {
  it('sets tls.servername for mailserver so STARTTLS matches the certificate', () => {
    const options = buildSmtpTransportOptions({ ...baseSettings, host: 'mailserver' })
    expect(options.tls).toEqual({ servername: 'mail.andiko.cloud' })
    expect(options.host).toBe('mailserver')
  })

  it('does not set tls for hosts that match their certificate', () => {
    const options = buildSmtpTransportOptions({ ...baseSettings, host: 'mail.andiko.cloud' })
    expect(options.tls).toBeUndefined()
  })
})
