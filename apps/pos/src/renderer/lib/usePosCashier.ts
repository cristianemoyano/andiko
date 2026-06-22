import { useEffect, useState } from 'react'

export type PosCashierInfo = {
  cashierName: string | null
  cashierUserId: string | null
  hasSession: boolean
  loading: boolean
}

/** Active cash-session cashier — refreshes on window focus and when `refreshKey` changes (e.g. nav screen). */
export function usePosCashier(refreshKey?: string): PosCashierInfo {
  const [info, setInfo] = useState<PosCashierInfo>({
    cashierName: null,
    cashierUserId: null,
    hasSession: false,
    loading: true,
  })

  useEffect(() => {
    let cancelled = false

    function load() {
      void window.pos.cashSessions.getCurrent().then((session) => {
        if (cancelled) return
        setInfo({
          cashierName: session?.cashier_name ?? null,
          cashierUserId: session?.cashier_user_id ?? null,
          hasSession: Boolean(session),
          loading: false,
        })
      }).catch(() => {
        if (!cancelled) setInfo(prev => ({ ...prev, loading: false }))
      })
    }

    load()
    window.addEventListener('focus', load)
    return () => {
      cancelled = true
      window.removeEventListener('focus', load)
    }
  }, [refreshKey])

  return info
}
