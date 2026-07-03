'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/primitives/Button'
import { COOKIE_CONSENT_ENABLED, getStoredCookieConsent, storeCookieConsent } from '@/lib/cookie-consent'
import { applyPostHogConsent } from '@/lib/posthog-consent'

// Cookie consent banner — mounted in the root layout.
export function CookieConsentBanner() {
  // Lazy initializer: reads localStorage once on mount, no effect/cascading render needed.
  const [visible, setVisible] = useState(() => COOKIE_CONSENT_ENABLED && getStoredCookieConsent() === null)

  useEffect(() => {
    const consent = getStoredCookieConsent()
    if (consent) applyPostHogConsent(consent)
  }, [])

  if (!COOKIE_CONSENT_ENABLED) return null
  if (!visible) return null

  function acceptAll() {
    const choice = { necessary: true, analytics: true } as const
    storeCookieConsent(choice)
    applyPostHogConsent(choice)
    setVisible(false)
  }

  function acceptNecessaryOnly() {
    const choice = { necessary: true, analytics: false } as const
    storeCookieConsent(choice)
    applyPostHogConsent(choice)
    setVisible(false)
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-surface p-4">
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-fg-muted leading-relaxed">
          Usamos cookies necesarias para el funcionamiento de la Plataforma y, si lo aceptás,
          cookies de analítica para mejorar el Servicio.
        </p>
        <div className="flex flex-shrink-0 gap-2">
          <Button variant="secondary" size="sm" onClick={acceptNecessaryOnly}>
            Solo necesarias
          </Button>
          <Button variant="primary" size="sm" onClick={acceptAll}>
            Aceptar todo
          </Button>
        </div>
      </div>
    </div>
  )
}
