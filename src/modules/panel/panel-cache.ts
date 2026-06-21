import type { PanelFilters } from './panel.service'

export const PANEL_CACHE_TTL_MS = 60_000
const MAX_ENTRIES = 256

interface CacheEntry<T> {
  expiresAt: number
  value: T
}

const store = new Map<string, CacheEntry<unknown>>()

export function panelCacheKey(orgId: string, namespace: string, filters: PanelFilters): string {
  return [
    namespace,
    orgId,
    filters.period,
    filters.from ?? '',
    filters.to ?? '',
    filters.branch_id ?? 'all',
  ].join(':')
}

/** In-memory TTL cache for panel read endpoints (per server instance). */
export async function getCachedPanelData<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const hit = store.get(key)
  if (hit && hit.expiresAt > now) {
    return hit.value as T
  }

  const value = await loader()
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value
    if (oldest) store.delete(oldest)
  }
  store.set(key, { value, expiresAt: now + PANEL_CACHE_TTL_MS })
  return value
}

/** Test helper — clears all panel cache entries. */
export function clearPanelCache(): void {
  store.clear()
}
