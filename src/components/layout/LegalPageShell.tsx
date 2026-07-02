'use client'

import { useRouter } from 'next/navigation'
import { AndikoLogo } from '@/components/layout/AndikoLogo'
import { Button } from '@/components/primitives/Button'

function ChevronLeftIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

export function LegalPageShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  function goBack() {
    if (typeof window === 'undefined') return

    if (window.history.length > 1) {
      router.back()
      return
    }

    if (document.referrer) {
      try {
        const referrerUrl = new URL(document.referrer)
        if (referrerUrl.origin === window.location.origin) {
          router.push(`${referrerUrl.pathname}${referrerUrl.search}${referrerUrl.hash}`)
          return
        }
      } catch {
        // ignore invalid referrer
      }
    }

    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-[#F7FBFC]">
      <header className="sticky top-0 z-10 border-b border-zinc-200/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4 sm:px-6">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 gap-1.5 text-zinc-700"
            onClick={goBack}
          >
            <ChevronLeftIcon />
            Volver
          </Button>
          <div className="ml-auto">
            <AndikoLogo href="/" size="sm" />
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
