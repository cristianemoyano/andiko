import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }))

import { lookup } from 'node:dns/promises'
import { assertPublicHttpTarget, isPrivateOrLoopbackIp } from './ssrf-guard'

const lookupMock = lookup as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  lookupMock.mockReset()
})

describe('isPrivateOrLoopbackIp', () => {
  it.each([
    ['127.0.0.1', true],
    ['10.0.0.5', true],
    ['172.16.0.1', true],
    ['172.31.255.255', true],
    ['192.168.1.1', true],
    ['169.254.169.254', true], // cloud metadata endpoint
    ['0.0.0.0', true],
    ['8.8.8.8', false],
    ['93.184.216.34', false],
  ])('%s -> private=%s', (ip, expected) => {
    expect(isPrivateOrLoopbackIp(ip)).toBe(expected)
  })

  it.each([
    ['::1', true],
    ['fc00::1', true],
    ['fe80::1', true],
    ['::ffff:127.0.0.1', true],
    ['2001:4860:4860::8888', false],
  ])('%s -> private=%s', (ip, expected) => {
    expect(isPrivateOrLoopbackIp(ip)).toBe(expected)
  })
})

describe('assertPublicHttpTarget', () => {
  it('rejects non-http(s) schemes without a DNS lookup', async () => {
    await expect(assertPublicHttpTarget('file:///etc/passwd')).rejects.toThrow('Esquema de URL no permitido')
    expect(lookupMock).not.toHaveBeenCalled()
  })

  it('rejects a hostname that resolves to a private address', async () => {
    lookupMock.mockResolvedValue({ address: '169.254.169.254', family: 4 })
    await expect(assertPublicHttpTarget('http://internal.example/meta')).rejects.toThrow('red privada o local')
  })

  it('allows a hostname that resolves to a public address', async () => {
    lookupMock.mockResolvedValue({ address: '93.184.216.34', family: 4 })
    await expect(assertPublicHttpTarget('https://example.com/hook')).resolves.toBeUndefined()
  })
})
