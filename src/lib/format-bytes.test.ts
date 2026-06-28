import { describe, it, expect } from 'vitest'
import { formatBytes } from './format-bytes'

describe('formatBytes', () => {
  it('formats bytes, KB, MB and GB', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(1024 * 1024)).toBe('1 MB')
    expect(formatBytes(5.5 * 1024 * 1024)).toBe('5.5 MB')
    expect(formatBytes(1024 ** 3)).toBe('1 GB')
  })

  it('accepts numeric strings (Postgres BIGINT)', () => {
    expect(formatBytes('2048')).toBe('2 KB')
  })

  it('returns an em dash for invalid input', () => {
    expect(formatBytes(null)).toBe('—')
    expect(formatBytes(undefined)).toBe('—')
    expect(formatBytes(-1)).toBe('—')
    expect(formatBytes('abc')).toBe('—')
  })
})
