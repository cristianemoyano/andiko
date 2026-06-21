'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/primitives/Button'
import { AndikoLogo } from './AndikoLogo'

/** Chrome/Android `beforeinstallprompt` event (not in the standard DOM lib). */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

const DISMISS_KEY = 'andiko:install-prompt-dismissed'

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone === true
}

function isIos(): boolean {
  if (typeof window === 'undefined') return false
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

/**
 * Mobile-only, dismissible "install app" banner. On Android/Chrome it triggers
 * the native install prompt; on iOS (which has no `beforeinstallprompt`) it
 * shows the Add-to-Home-Screen hint. Hidden once installed/standalone or after
 * the user dismisses it (persisted in localStorage).
 */
export function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return
    } catch {
      // Ignore storage failures (private mode); treat as not dismissed.
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setPromptEvent(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setPromptEvent(null)
      setShowIosHint(false)
      setDismissed(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    // iOS Safari never fires `beforeinstallprompt`. Reveal the manual hint from
    // a callback (not synchronously in the effect body) to avoid cascading
    // renders and any hydration flash.
    const raf = requestAnimationFrame(() => {
      if (isIos()) setShowIosHint(true)
    })

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function dismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Ignore storage failures (private mode); banner just reappears next load.
    }
  }

  async function install() {
    if (!promptEvent) return
    await promptEvent.prompt()
    await promptEvent.userChoice
    setPromptEvent(null)
    dismiss()
  }

  if (dismissed) return null
  if (!promptEvent && !showIosHint) return null

  return (
    <div
      className="md:hidden fixed inset-x-0 z-[60] px-3 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.5rem)]"
      role="dialog"
      aria-label="Instalar Andiko"
    >
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 shadow-lg">
        <AndikoLogo href="" size="sm" className="pointer-events-none shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-fg leading-tight">Instalar Andiko</p>
          <p className="text-[11px] text-fg-muted leading-snug">
            {promptEvent
              ? 'Accedé más rápido desde tu pantalla de inicio.'
              : 'Tocá Compartir y luego “Agregar a inicio”.'}
          </p>
        </div>
        {promptEvent ? (
          <Button size="sm" onClick={install} className="shrink-0">
            Instalar
          </Button>
        ) : null}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Descartar"
          className="shrink-0 text-fg-subtle hover:text-fg p-1"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
