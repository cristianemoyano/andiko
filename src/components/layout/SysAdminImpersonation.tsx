'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Dialog } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { cn } from '@/lib/utils'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { fetchLandingPath } from '@/lib/landing-path-client'
import { useCapabilities } from './CapabilitiesContext'

type UserHit = {
  id: string
  email: string
  name: string
  role: string
  org_id: string | null
  org_name: string | null
  branch_id: string | null
}

type RecentImpersonation = Pick<UserHit, 'id' | 'email' | 'name' | 'role' | 'org_name'>

const RECENT_IMPERSONATIONS_KEY = 'andiko:impersonation-recent'
const RECENT_IMPERSONATIONS_LIMIT = 5

function readRecentImpersonations(): RecentImpersonation[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENT_IMPERSONATIONS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((row): row is RecentImpersonation =>
        typeof row === 'object'
        && row !== null
        && typeof (row as RecentImpersonation).id === 'string'
        && typeof (row as RecentImpersonation).email === 'string'
        && typeof (row as RecentImpersonation).name === 'string'
        && typeof (row as RecentImpersonation).role === 'string',
      )
      .map(row => ({
        ...row,
        org_name: typeof row.org_name === 'string' ? row.org_name : null,
      }))
      .slice(0, RECENT_IMPERSONATIONS_LIMIT)
  } catch {
    return []
  }
}

function pushRecentImpersonation(user: RecentImpersonation): RecentImpersonation[] {
  const next = [user, ...readRecentImpersonations().filter(u => u.id !== user.id)].slice(0, RECENT_IMPERSONATIONS_LIMIT)
  try {
    window.localStorage.setItem(RECENT_IMPERSONATIONS_KEY, JSON.stringify(next))
  } catch {
    // localStorage full or unavailable — ignore
  }
  return next
}

function removeRecentImpersonation(userId: string): RecentImpersonation[] {
  const next = readRecentImpersonations().filter(u => u.id !== userId)
  try {
    window.localStorage.setItem(RECENT_IMPERSONATIONS_KEY, JSON.stringify(next))
  } catch {
    // localStorage full or unavailable — ignore
  }
  return next
}

function UserPickRow({
  user,
  disabled,
  onPick,
  onRemove,
}: {
  user: RecentImpersonation
  disabled: boolean
  onPick: () => void
  onRemove?: () => void
}) {
  return (
    <li className="flex items-stretch">
      <button
        type="button"
        disabled={disabled}
        onClick={onPick}
        className="min-w-0 flex-1 text-left px-3 py-2 text-[13px] hover:bg-surface-muted disabled:opacity-50"
      >
        <div className="font-medium text-fg">{user.name}</div>
        <div className="text-[11px] text-fg-muted">{user.email}</div>
        <div className="text-[10px] text-fg-subtle mt-0.5">
          {user.org_name ?? 'Sin organización'}
          {' · '}
          {user.role}
        </div>
      </button>
      {onRemove && (
        <button
          type="button"
          disabled={disabled}
          onClick={onRemove}
          aria-label={`Quitar a ${user.name} de recientes`}
          className="shrink-0 px-2.5 text-fg-muted hover:text-fg hover:bg-surface-muted disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </li>
  )
}

/** “Entrar como otro usuario”: figura actual → flecha → usuario destino. */
function ImpersonateActionIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="5" cy="5" r="2.25" />
      <path d="M1.75 13.5a3.35 3.35 0 0 1 6.5 0" />
      <path d="M9.25 8h3.75M11.75 6.25 14 8 11.75 9.75" />
      <circle cx="12.75" cy="5" r="2" />
      <path d="M9.5 13.5a2.75 2.75 0 0 1 5.25 0" />
    </svg>
  )
}

export function SysAdminImpersonation({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter()
  const { data: session, status, update } = useSession()
  const { refreshCapabilities } = useCapabilities()
  const [modalOpen, setModalOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<UserHit[]>([])
  const [loading, setLoading] = useState(false)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recentUsers, setRecentUsers] = useState<RecentImpersonation[]>([])

  const isSysAdminAccount = session?.user?.realRole === 'sys-admin'

  function openImpersonationModal() {
    setError(null)
    setRecentUsers(readRecentImpersonations())
    setModalOpen(true)
  }

  useEffect(() => {
    if (!modalOpen || !isSysAdminAccount) return
    const q = query.trim()
    if (q.length < 2) return

    let cancelled = false
    const t = window.setTimeout(() => {
      void (async () => {
        setLoading(true)
        try {
          const j = await fetchJson<{ data?: UserHit[] }>(`/api/v1/sys-admin/users?q=${encodeURIComponent(q)}&limit=20`)
          if (!cancelled) setHits(j.data ?? [])
        } catch {
          if (!cancelled) setHits([])
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
    }, 320)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [modalOpen, query, isSysAdminAccount])

  const trimmedQuery = query.trim()
  const displayHits = trimmedQuery.length < 2 ? [] : hits

  async function handleImpersonate(user: RecentImpersonation) {
    setSubmittingId(user.id)
    setError(null)
    try {
      await fetchJson('/api/v1/session/impersonate', {
        method: 'POST',
        body: JSON.stringify({ userId: user.id }),
      })
      await update({ impersonation: { userId: user.id } })
      await refreshCapabilities()
      const path = await fetchLandingPath()
      router.push(path)
      router.refresh()
      setRecentUsers(pushRecentImpersonation(user))
      setModalOpen(false)
      setQuery('')
      setHits([])
    } catch (e) {
      setError(getApiErrorMessage(e))
    } finally {
      setSubmittingId(null)
    }
  }

  async function handleStopImpersonation() {
    setError(null)
    await update({ impersonation: null })
    await refreshCapabilities()
    const path = await fetchLandingPath()
    router.push(path)
    router.refresh()
  }

  if (status !== 'authenticated' || !isSysAdminAccount) {
    return null
  }

  const imp = session.user.impersonation
  const actionLabel = imp ? 'Cambiar usuario' : 'Impersonar usuario'

  return (
    <div className={cn('mb-1 flex flex-col gap-1.5', collapsed && 'md:items-center')}>
      {imp && (
        <div
          className={cn(
            'rounded-md border border-warning bg-warning-bg text-[11px] leading-snug text-warning',
            collapsed ? 'px-1 py-1.5 md:px-1' : 'px-2 py-2',
          )}
          role="status"
          title={collapsed ? `Impersonando: ${imp.name}` : undefined}
        >
          <div className={cn('font-semibold text-warning', collapsed && 'md:sr-only')}>Impersonando</div>
          <div className={cn('mt-0.5 truncate', collapsed && 'md:hidden')}>
            {imp.name} · {imp.email}
          </div>
          {collapsed && (
            <div className="hidden text-center text-[9px] font-semibold uppercase tracking-wide md:block" aria-hidden>
              Imp
            </div>
          )}
          <div className={cn('mt-1.5', collapsed && 'md:mt-1 md:flex md:justify-center')}>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => void handleStopImpersonation()}
              className={collapsed ? 'md:px-1.5' : undefined}
              title="Volver a sys-admin"
            >
              <span className={cn(collapsed && 'md:hidden')}>Volver a sys-admin</span>
              <svg
                className={cn('hidden', collapsed && 'md:block')}
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M6 3 2 8l4 5M2 8h12" />
              </svg>
            </Button>
          </div>
        </div>
      )}

      <button
        type="button"
        title={imp ? 'Cambiar de usuario impersonado' : 'Impersonar otro usuario'}
        onClick={openImpersonationModal}
        className={cn(
          'mb-px flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] transition-colors',
          'text-fg-muted hover:bg-surface-hover',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-0',
          collapsed && 'md:h-9 md:w-9 md:justify-center md:gap-0 md:px-0',
        )}
      >
        <span className="flex-shrink-0 text-fg-subtle">
          <ImpersonateActionIcon />
        </span>
        <span className={cn('truncate', collapsed && 'md:sr-only')}>{actionLabel}</span>
      </button>

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          if (open) {
            setRecentUsers(readRecentImpersonations())
          }
          setModalOpen(open)
          if (!open) {
            setQuery('')
            setHits([])
            setError(null)
          }
        }}
        title="Buscar usuario a impersonar"
        size="md"
      >
        <div className="flex flex-col gap-3">
          <Input
            id="impersonate-search"
            placeholder="Nombre o email (mín. 2 caracteres)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoComplete="off"
          />
          {trimmedQuery.length < 2 && recentUsers.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-fg-muted">Recientes</p>
              <ul className="max-h-[180px] overflow-y-auto divide-y divide-border rounded-sm border border-border">
                {recentUsers.map(u => (
                  <UserPickRow
                    key={u.id}
                    user={u}
                    disabled={!!submittingId}
                    onPick={() => void handleImpersonate(u)}
                    onRemove={() => setRecentUsers(removeRecentImpersonation(u.id))}
                  />
                ))}
              </ul>
            </div>
          )}
          {loading && trimmedQuery.length >= 2 && (
            <p className="text-[11px] text-fg-muted">Buscando…</p>
          )}
          {!loading && trimmedQuery.length >= 2 && displayHits.length === 0 && (
            <p className="text-[11px] text-fg-muted">Sin resultados.</p>
          )}
          {trimmedQuery.length >= 2 && displayHits.length > 0 && (
            <ul className="max-h-[240px] overflow-y-auto divide-y divide-border rounded-sm border border-border">
              {displayHits.map(h => (
                <UserPickRow
                  key={h.id}
                  user={h}
                  disabled={!!submittingId}
                  onPick={() => void handleImpersonate(h)}
                />
              ))}
            </ul>
          )}
          {error && (
            <p role="alert" className="text-[12px] text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex justify-end">
            <Button type="button" variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
