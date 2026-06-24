/*
 * Andiko service worker.
 *
 * Two jobs, both safe for a financial ERP:
 *   1. Make the app installable as a standalone PWA (Chrome/Android require a
 *      registered service worker with a `fetch` handler before offering
 *      "Install").
 *   2. Cache-first for Next's immutable, content-hashed static assets
 *      (`/_next/static/...`) and app icons, so repeat loads are instant and
 *      the app shell can paint without the network.
 *
 * What is NEVER cached: HTML navigations and anything under `/api/*`. Those can
 * carry live financial data (invoices, balances), so they always hit the
 * network — no risk of serving stale data. Hashed static assets are immutable
 * (the filename changes when the content changes), so caching them is safe.
 *
 * Bump CACHE_VERSION to purge old asset caches on the next activation.
 */

const CACHE_VERSION = 'v1'
const STATIC_CACHE = `andiko-static-${CACHE_VERSION}`

self.addEventListener('install', () => {
  // Activate this worker immediately instead of waiting for old tabs to close.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from previous versions, then take control of open clients.
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
      // Start network request in parallel with SW startup on repeat navigations.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable()
      }
    })(),
  )
})

/** Immutable, content-hashed assets that are safe to cache forever. */
function isCacheableAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/'))
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  // Use navigation preload response when available — it started in parallel with
  // SW startup so the browser doesn't pay SW boot time on repeat visits.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const preload = await event.preloadResponse
          if (preload) return preload
        } catch {}
        return fetch(request)
      })(),
    )
    return
  }

  const url = new URL(request.url)
  if (!isCacheableAsset(url)) {
    // API calls and everything else: let the browser handle it
    // over the network. No service-worker cache layer, no stale data.
    return
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE)
      const cached = await cache.match(request)
      if (cached) return cached
      const response = await fetch(request)
      if (response.ok) cache.put(request, response.clone())
      return response
    })(),
  )
})
