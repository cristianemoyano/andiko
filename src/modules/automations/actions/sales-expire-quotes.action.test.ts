import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@/modules/sales/sales-quote-expiration.service', () => ({
  expireOverdueQuotes: vi.fn(),
}))

import { expireOverdueQuotes } from '@/modules/sales/sales-quote-expiration.service'
import { getAutomationAction } from '../action-registry'
import './sales-expire-quotes.action'

const expireOverdueQuotesMock = expireOverdueQuotes as unknown as Mock

beforeEach(() => {
  expireOverdueQuotesMock.mockReset()
})

describe('sales.expire_overdue_quotes action', () => {
  it('is registered', () => {
    expect(getAutomationAction('sales.expire_overdue_quotes')).toBeDefined()
  })

  it('scopes expireOverdueQuotes to the task org and returns a summary', async () => {
    expireOverdueQuotesMock.mockResolvedValue({ expired_count: 3 })
    const action = getAutomationAction('sales.expire_overdue_quotes')!

    const result = await action.run(
      { orgId: 'org-1', branchId: null, taskId: 'task-1', runId: 'run-1', signal: new AbortController().signal },
      {},
    )

    expect(expireOverdueQuotesMock).toHaveBeenCalledWith('org-1')
    expect(result.data).toEqual({ expired_count: 3 })
    expect(result.summary).toContain('3')
  })
})
