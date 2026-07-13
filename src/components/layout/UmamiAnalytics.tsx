'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'

import { subscribeAnalyticsConsent } from '@/lib/analytics-consent'
import { COOKIE_CONSENT_ENABLED, getStoredCookieConsent } from '@/lib/cookie-consent'
import { isUmamiEnabled, umamiScriptUrl, UMAMI_WEBSITE_ID } from '@/lib/umami-config'

function hasAnalyticsConsent(): boolean {
  if (!COOKIE_CONSENT_ENABLED) return true
  const consent = getStoredCookieConsent()
  return consent?.analytics === true
}

export function UmamiAnalytics() {
  const [loadScript, setLoadScript] = useState(false)

  useEffect(() => {
    if (!isUmamiEnabled()) return

    const sync = () => {
      setLoadScript(hasAnalyticsConsent())
    }

    sync()
    return subscribeAnalyticsConsent(sync)
  }, [])

  if (!loadScript) return null

  return (
    <Script
      defer
      src={umamiScriptUrl()}
      data-website-id={UMAMI_WEBSITE_ID}
      strategy="afterInteractive"
    />
  )
}
