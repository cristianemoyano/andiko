'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from 'next-auth'
import { useSession } from 'next-auth/react'
import { fetchJson } from '@/lib/fetch-json'
import type { UiCapabilities } from '@/types/capabilities'

type CapabilitiesContextValue = {
  capabilities: UiCapabilities | null
  refreshing: boolean
  refreshCapabilities: () => Promise<void>
}

const noopRefresh = async () => {}

const CapabilitiesContext = createContext<CapabilitiesContextValue>({
  capabilities: null,
  refreshing: false,
  refreshCapabilities: noopRefresh,
})

function sessionCapabilitiesKey(session: Session): string {
  const u = session.user
  return [
    u.role,
    u.orgRoleId ?? '',
    u.orgId ?? '',
    u.actingOrgId ?? '',
    u.impersonation?.userId ?? '',
    u.impersonation?.role ?? '',
    u.impersonation?.orgRoleId ?? '',
  ].join('|')
}

export function CapabilitiesProvider({
  initial,
  children,
}: {
  initial: UiCapabilities | null
  children: ReactNode
}) {
  const { data: session, status } = useSession()
  const [capabilities, setCapabilities] = useState<UiCapabilities | null>(initial)
  const [refreshing, setRefreshing] = useState(false)
  const sessionKeyRef = useRef<string | null>(null)

  const refreshCapabilities = useCallback(async () => {
    setRefreshing(true)
    try {
      const data = await fetchJson<{ capabilities: UiCapabilities }>('/api/v1/session/capabilities')
      setCapabilities(data.capabilities)
    } catch {
      // Keep last known capabilities on transient failures.
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return
    const key = sessionCapabilitiesKey(session)
    if (sessionKeyRef.current === null) {
      sessionKeyRef.current = key
      return
    }
    if (sessionKeyRef.current === key) return
    sessionKeyRef.current = key
    void refreshCapabilities()
  }, [session, status, refreshCapabilities])

  return (
    <CapabilitiesContext.Provider value={{ capabilities, refreshing, refreshCapabilities }}>
      {children}
    </CapabilitiesContext.Provider>
  )
}

export function useCapabilities(): CapabilitiesContextValue {
  return useContext(CapabilitiesContext)
}
