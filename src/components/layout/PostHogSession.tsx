'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import posthog from 'posthog-js'

import { COOKIE_CONSENT_ENABLED, getStoredCookieConsent } from '@/lib/cookie-consent'
import { isPostHogEnabled } from '@/lib/posthog-config'

function hasAnalyticsConsent(): boolean {
  if (!COOKIE_CONSENT_ENABLED) return true
  return getStoredCookieConsent()?.analytics ?? false
}

/** Syncs session identity and stored cookie consent with PostHog. */
export function PostHogSession() {
  const { data: session, status } = useSession()
  const identifiedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isPostHogEnabled() || status !== 'authenticated' || !session?.user?.id) return
    if (!hasAnalyticsConsent()) return

    const userId = session.user.id
    if (identifiedRef.current === userId) return

    posthog.identify(userId, {
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      org_id: session.user.orgId,
      branch_id: session.user.branchId,
      real_role: session.user.realRole,
      is_impersonating: Boolean(session.user.impersonation),
    })
    identifiedRef.current = userId
  }, [session, status])

  useEffect(() => {
    if (status !== 'unauthenticated' || !identifiedRef.current) return
    posthog.reset()
    identifiedRef.current = null
  }, [status])

  return null
}
