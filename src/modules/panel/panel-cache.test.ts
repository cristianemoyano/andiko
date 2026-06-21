import { describe, it, expect, beforeEach, vi } from 'vitest'
import { clearPanelCache, getCachedPanelData, panelCacheKey, PANEL_CACHE_TTL_MS } from './panel-cache'
import type { PanelFilters } from './panel.service'

const ORG = 'org-1'
const FILTERS: PanelFilters = { period: 'last_month', branch_id: 'all' }

beforeEach(() => {
  clearPanelCache()
  vi.useRealTimers()
})

describe('panel-cache', () => {
  it('returns cached value within TTL without calling loader again', async () => {
    const loader = vi.fn().mockResolvedValue({ ok: true })
    const key = panelCacheKey(ORG, 'kpis', FILTERS)

    const first = await getCachedPanelData(key, loader)
    const second = await getCachedPanelData(key, loader)

    expect(first).toEqual({ ok: true })
    expect(second).toEqual({ ok: true })
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('reloads after TTL expires', async () => {
    vi.useFakeTimers()
    const loader = vi.fn()
      .mockResolvedValueOnce({ v: 1 })
      .mockResolvedValueOnce({ v: 2 })
    const key = panelCacheKey(ORG, 'kpis', FILTERS)

    await getCachedPanelData(key, loader)
    vi.advanceTimersByTime(PANEL_CACHE_TTL_MS + 1)
    const next = await getCachedPanelData(key, loader)

    expect(next).toEqual({ v: 2 })
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('uses distinct keys per org and filters', async () => {
    const loader = vi.fn().mockImplementation((k: string) => Promise.resolve(k))
    const keyA = panelCacheKey('org-a', 'kpis', FILTERS)
    const keyB = panelCacheKey('org-b', 'kpis', FILTERS)

    await getCachedPanelData(keyA, () => loader('a'))
    await getCachedPanelData(keyB, () => loader('b'))

    expect(loader).toHaveBeenCalledTimes(2)
  })
})
