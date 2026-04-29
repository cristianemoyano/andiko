import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/modules/pos/pos-device.model', () => ({
  default: { findOne: vi.fn() },
}))

import PosDevice from '@/modules/pos/pos-device.model'
import { withPosDevice } from './pos-auth'

const makeReq = (token?: string) =>
  new NextRequest('http://localhost/api/v1/pos/products', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })

const mockDevice = {
  id: 'device-row-id',
  device_id: 'dev-abc',
  org_id: 'org-123',
  branch_id: 'branch-456',
  update: vi.fn().mockResolvedValue(undefined),
}

beforeEach(() => vi.clearAllMocks())

describe('withPosDevice', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const handler = vi.fn()
    const res = await withPosDevice(handler)(makeReq())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe('UNAUTHORIZED')
    expect(handler).not.toHaveBeenCalled()
  })

  it('returns 401 when token does not match any active device', async () => {
    vi.mocked(PosDevice.findOne).mockResolvedValue(null as never)
    const handler = vi.fn()
    const res = await withPosDevice(handler)(makeReq('bad-token'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe('INVALID_TOKEN')
    expect(handler).not.toHaveBeenCalled()
  })

  it('calls handler with device context when token is valid', async () => {
    vi.mocked(PosDevice.findOne).mockResolvedValue(mockDevice as never)
    const handler = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
    await withPosDevice(handler)(makeReq('valid-token'))
    expect(handler).toHaveBeenCalledWith(
      expect.any(NextRequest),
      {
        deviceId: 'dev-abc',
        orgId: 'org-123',
        branchId: 'branch-456',
        deviceRowId: 'device-row-id',
      },
    )
  })

  it('bumps last_seen_at without blocking on valid auth', async () => {
    vi.mocked(PosDevice.findOne).mockResolvedValue(mockDevice as never)
    const handler = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
    await withPosDevice(handler)(makeReq('valid-token'))
    expect(mockDevice.update).toHaveBeenCalledWith({ last_seen_at: expect.any(Date) })
  })
})
