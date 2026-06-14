import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { EmailSettings } from './email-settings.schema'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const { getResolvedEmailSettings, buildTransport } = vi.hoisted(() => ({
  getResolvedEmailSettings: vi.fn(),
  buildTransport: vi.fn(),
}))
vi.mock('./email-settings.service', () => ({ getResolvedEmailSettings }))
vi.mock('./transport', () => ({ buildTransport }))

import { sendTestEmail, SMTP_NOT_CONFIGURED, EMAIL_TEST_FAILED } from './send-test.service'

const settings: EmailSettings = {
  enabled: true,
  host: 'smtp.test',
  port: 587,
  secure: false,
  user: 'u@test.com',
  password: 'secret',
  from_name: 'Andiko',
  from_address: 'no-reply@andiko.app',
}

describe('sendTestEmail', () => {
  beforeEach(() => {
    getResolvedEmailSettings.mockReset()
    buildTransport.mockReset()
  })

  it('throws SMTP_NOT_CONFIGURED when SMTP is not enabled/configured', async () => {
    getResolvedEmailSettings.mockResolvedValue(null)
    await expect(sendTestEmail('dest@test.com')).rejects.toThrow(SMTP_NOT_CONFIGURED)
    expect(buildTransport).not.toHaveBeenCalled()
  })

  it('sends a test email through the saved settings and returns the recipient', async () => {
    getResolvedEmailSettings.mockResolvedValue(settings)
    const send = vi.fn().mockResolvedValue({ transport: 'smtp', messageId: '<abc@smtp>' })
    buildTransport.mockReturnValue({ kind: 'smtp', send })

    const result = await sendTestEmail('dest@test.com')

    expect(buildTransport).toHaveBeenCalledWith(settings)
    expect(send).toHaveBeenCalledTimes(1)
    const email = send.mock.calls[0][0]
    expect(email.to).toBe('dest@test.com')
    expect(email.subject).toContain('prueba')
    expect(email.html).toContain('andiko')
    expect(email.text.length).toBeGreaterThan(0)
    expect(result).toEqual({ transport: 'smtp', messageId: '<abc@smtp>', recipient: 'dest@test.com' })
  })

  it('wraps a transport failure as EMAIL_TEST_FAILED with the original detail', async () => {
    getResolvedEmailSettings.mockResolvedValue(settings)
    const send = vi.fn().mockRejectedValue(new Error('Invalid login: 535'))
    buildTransport.mockReturnValue({ kind: 'smtp', send })

    await expect(sendTestEmail('dest@test.com')).rejects.toMatchObject({
      message: EMAIL_TEST_FAILED,
      detail: 'Invalid login: 535',
    })
  })
})
