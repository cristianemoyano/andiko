'use client'

import { useEffect } from 'react'

/**
 * Registers the static `/sw.js` service worker on the client. The worker makes
 * the app installable as a standalone PWA and cache-firsts immutable static
 * assets; it never caches HTML or API data. Renders nothing.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Registration failures are non-fatal — the app still works in-browser.
      })
    }

    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register, { once: true })
      return () => window.removeEventListener('load', register)
    }
  }, [])

  return null
}
