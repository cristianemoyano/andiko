'use client'

import { useState, useEffect, useCallback } from 'react'
import { SaleScreen } from './screens/SaleScreen'
import { SalesHistoryScreen } from './screens/SalesHistoryScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { LicenseBlockScreen } from './screens/LicenseBlockScreen'
import { CashSessionScreen } from './screens/CashSessionScreen'

type Screen = 'sale' | 'sales' | 'cash-session' | 'settings'
type LicenseState =
  | { status: 'checking' }
  | { status: 'ok' }
  | { status: 'grace'; daysLeft: number }
  | { status: 'blocked'; reason: 'revoked' | 'expired' | 'no_config' | 'unknown' }

function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on  = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}

const LICENSE_CHECK_INTERVAL_MS = 30 * 60 * 1000 // re-check every 30 min while running

export function App() {
  const [screen, setScreen] = useState<Screen>('sale')
  const online = useOnlineStatus()
  const [license, setLicense] = useState<LicenseState>({ status: 'ok' })
  const [retrying, setRetrying] = useState(false)
  const [resumeDraftId, setResumeDraftId] = useState<string | null>(null)

  const checkLicense = useCallback(async () => {
    const result = await window.pos.sync.checkLicense()
    setLicense(result as LicenseState)
    return result
  }, [])

  // Check on startup
  // eslint-disable-next-line react-hooks/set-state-in-effect -- checkLicense triggers async state update, not synchronous setState
  useEffect(() => { checkLicense() }, [checkLicense])

  // Re-check periodically to catch revocations while running
  useEffect(() => {
    const timer = setInterval(() => { checkLicense() }, LICENSE_CHECK_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [checkLicense])

  async function handleRetry() {
    setRetrying(true)
    await checkLicense()
    setRetrying(false)
  }

  if (license.status === 'blocked') {
    return (
      <LicenseBlockScreen
        reason={license.reason}
        onRetry={handleRetry}
        retrying={retrying}
        onConfigure={() => {
          setLicense({ status: 'ok' })
          setScreen('settings')
        }}
      />
    )
  }

  return (
    <div className="flex h-screen bg-zinc-100 font-sans text-zinc-900">
      {/* Sidebar nav */}
      <nav className="flex flex-col w-14 bg-zinc-900 items-center py-4 gap-3 shrink-0">
        <NavBtn active={screen === 'sale'} onClick={() => setScreen('sale')} title="Venta">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
          </svg>
        </NavBtn>
        <NavBtn active={screen === 'sales'} onClick={() => setScreen('sales')} title="Ventas">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 12h6"/><path d="M9 16h6"/><path d="M10 2h4"/><path d="M12 14v7"/><path d="M6 7h12"/><path d="M8 22h8"/><path d="M7 22V7a2 2 0 012-2h6a2 2 0 012 2v15"/>
          </svg>
        </NavBtn>
        <NavBtn active={screen === 'cash-session'} onClick={() => setScreen('cash-session')} title="Turno de caja">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        </NavBtn>
        <NavBtn active={screen === 'settings'} onClick={() => setScreen('settings')} title="Configuración">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </NavBtn>

        {/* Spacer */}
        <div className="flex-1" />

        {/* App version */}
        <span className="text-[9px] text-zinc-600 font-mono select-none">v{__APP_VERSION__}</span>

        {/* Connectivity indicator */}
        <div
          title={online ? 'Conectado al cloud' : 'Sin conexión — modo offline'}
          className="w-10 h-10 flex items-center justify-center"
        >
          {online ? (
            <span className="flex flex-col items-center gap-0.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><circle cx="12" cy="20" r="1" fill="#4ade80" stroke="none"/>
              </svg>
              <span className="text-[8px] text-green-400 font-medium leading-none">online</span>
            </span>
          ) : (
            <span className="flex flex-col items-center gap-0.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0119 12.55"/><path d="M5 12.55a10.94 10.94 0 015.17-2.39"/><path d="M10.71 5.05A16 16 0 0122.56 9"/><path d="M1.42 9a15.91 15.91 0 014.7-2.88"/><path d="M8.53 16.11a6 6 0 016.95 0"/><circle cx="12" cy="20" r="1" fill="#f87171" stroke="none"/>
              </svg>
              <span className="text-[8px] text-red-400 font-medium leading-none">offline</span>
            </span>
          )}
        </div>
      </nav>

      {/* Offline banner */}
      {!online && (
        <div className="absolute top-0 left-14 right-0 z-50 bg-amber-500 text-amber-950 text-[12px] font-medium text-center py-1">
          Modo offline — las ventas se guardan localmente y se sincronizan al reconectar
        </div>
      )}

      {/* Grace period warning */}
      {license.status === 'grace' && (
        <div className="absolute top-0 left-14 right-0 z-50 bg-orange-600 text-white text-[12px] font-medium text-center py-1">
          Sin conexión al servidor — {license.daysLeft} día{license.daysLeft !== 1 ? 's' : ''} de gracia restante{license.daysLeft !== 1 ? 's' : ''}. Conectate para renovar la licencia.
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {screen === 'sale'     && <SaleScreen resumeDraftId={resumeDraftId} onResumeDraftConsumed={() => setResumeDraftId(null)} />}
        {screen === 'sales'    && (
          <SalesHistoryScreen
            onResumeDraft={(draftId) => {
              setResumeDraftId(draftId)
              setScreen('sale')
            }}
          />
        )}
        {screen === 'cash-session'  && <CashSessionScreen />}
        {screen === 'settings'      && <SettingsScreen onLicenseResult={checkLicense} />}
      </main>
    </div>
  )
}

function NavBtn({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
        active ? 'bg-brand-600 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}
