import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/config/env', () => ({ env: { NODE_ENV: 'test' } }))
vi.mock('@/modules/automations/scheduled-task-runner.service', () => ({
  runDueScheduledTasks: vi.fn(),
}))

import { runDueScheduledTasks } from '@/modules/automations/scheduled-task-runner.service'
import { POST } from './route'

const runDueScheduledTasksMock = runDueScheduledTasks as unknown as ReturnType<typeof vi.fn>

const originalCronSecret = process.env.CRON_SECRET

afterEach(() => {
  process.env.CRON_SECRET = originalCronSecret
})

beforeEach(() => {
  vi.clearAllMocks()
})

function makeRequest(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/v1/sys-admin/jobs/automations-tick', { method: 'POST', headers })
}

describe('POST /api/v1/sys-admin/jobs/automations-tick', () => {
  it('rejects requests without a valid CRON_SECRET bearer token', async () => {
    process.env.CRON_SECRET = 'super-secret'
    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
    expect(runDueScheduledTasksMock).not.toHaveBeenCalled()
  })

  it('runs the tick when the bearer token matches', async () => {
    process.env.CRON_SECRET = 'super-secret'
    runDueScheduledTasksMock.mockResolvedValueOnce({ claimed: 2, succeeded: 2, failed: 0, skipped: 0 })

    const res = await POST(makeRequest({ authorization: 'Bearer super-secret' }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true, claimed: 2, succeeded: 2, failed: 0, skipped: 0 })
  })
})
