'use client'

import { usePathname } from 'next/navigation'
import { OnboardingResumeBanner } from './OnboardingResumeBanner'

export function OnboardingResumeBannerGate({ enabled }: { enabled: boolean }) {
  const pathname = usePathname()

  if (!enabled || pathname.startsWith('/onboarding')) {
    return null
  }

  return <OnboardingResumeBanner />
}
