'use client'

import Link from 'next/link'

export function OnboardingResumeBanner() {
  return (
    <div className="flex-shrink-0 border-b border-teal-200 bg-teal-50 px-4 py-2.5 md:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-teal-900">
          Tenés una <strong>configuración inicial</strong> sin terminar.
        </p>
        <Link
          href="/onboarding"
          className="inline-flex h-8 items-center rounded-sm border border-teal-300 bg-surface px-3 text-[12px] font-medium text-teal-800 transition-colors hover:bg-teal-100"
        >
          Continuar configuración
        </Link>
      </div>
    </div>
  )
}
