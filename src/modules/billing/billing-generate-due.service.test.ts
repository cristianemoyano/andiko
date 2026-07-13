import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

vi.mock('./org-subscription.model', () => ({
  default: {
    findAll: vi.fn(),
    count: vi.fn(),
    findOne: vi.fn(),
  },
}))

vi.mock('./billing-invoices.service', () => ({
  generateInvoiceForPeriod: vi.fn(),
}))

import OrgSubscription from './org-subscription.model'
import { generateInvoiceForPeriod } from './billing-invoices.service'
import { generateDueBillingInvoices } from './billing-generate-due.service'

const findAll = OrgSubscription.findAll as unknown as Mock
const count = OrgSubscription.count as unknown as Mock
const findOne = OrgSubscription.findOne as unknown as Mock
const generateInvoice = generateInvoiceForPeriod as unknown as Mock

describe('generateDueBillingInvoices', () => {
  beforeEach(() => {
    findAll.mockReset()
    count.mockReset()
    findOne.mockReset()
    generateInvoice.mockReset()
  })

  it('returns empty when no due subscriptions', async () => {
    count.mockResolvedValueOnce(2).mockResolvedValueOnce(0)
    findOne.mockResolvedValue({ current_period_end: new Date('2026-07-31T23:59:59.999Z') })
    findAll.mockResolvedValue([])

    const result = await generateDueBillingInvoices('actor-1')
    expect(result.generated).toBe(0)
    expect(result.failed).toBe(0)
    expect(result.examined).toBe(0)
    expect(result.active_subscriptions).toBe(2)
    expect(result.next_period_end).toBe('2026-07-31T23:59:59.999Z')
    expect(generateInvoice).not.toHaveBeenCalled()
  })

  it('generates invoices and isolates failures', async () => {
    count.mockResolvedValue(2)
    findOne.mockResolvedValue(null)
    findAll.mockResolvedValue([
      { id: 'sub-1', org_id: 'org-1' },
      { id: 'sub-2', org_id: 'org-2' },
    ])
    generateInvoice
      .mockResolvedValueOnce({ id: 'inv-1' })
      .mockRejectedValueOnce(new Error('PLAN_NOT_FOUND'))

    const result = await generateDueBillingInvoices('actor-1')

    expect(result.examined).toBe(2)
    expect(result.generated).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.details[0]).toMatchObject({
      subscription_id: 'sub-1',
      status: 'generated',
      invoice_id: 'inv-1',
    })
    expect(result.details[1]).toMatchObject({
      subscription_id: 'sub-2',
      status: 'failed',
      error: 'PLAN_NOT_FOUND',
    })
  })
})
