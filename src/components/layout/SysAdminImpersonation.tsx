'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Dialog } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { cn } from '@/lib/utils'

type UserHit = {
  id: string
  email: string
  name: string
  role: string
  org_id: string | null
  branch_id: string | null
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

export function SysAdminImpersonation() {
  const { data: session, status, update } = useSession()
  const [modalOpen, setModalOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<UserHit[]>([])
  const [loading, setLoading] = useState(false)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isSysAdminAccount = session?.user?.realRole === 'sys-admin'

  useEffect(() => {
    if (!modalOpen || !isSysAdminAccount) return
    const q = query.trim()
    if (q.length < 2) return

    let cancelled = false
    const t = window.setTimeout(() => {
      void (async () => {
        setLoading(true)
        try {
          const res = await fetch(`/api/v1/sys-admin/users?q=${encodeURIComponent(q)}&limit=20`)
          const j = await res.json() as { data?: UserHit[] }
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

  async function handleImpersonate(userId: string) {
    setSubmittingId(userId)
    setError(null)
    try {
      const res = await fetch('/api/v1/session/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const body = await res.json().catch(() => ({})) as { error?: string; ok?: boolean }
      if (!res.ok) {
        setError(body.error ?? `Error ${res.status}`)
        return
      }
      await update({ impersonation: { userId } })
      setModalOpen(false)
      setQuery('')
      setHits([])
    } finally {
      setSubmittingId(null)
    }
  }

  async function handleStopImpersonation() {
    setError(null)
    await update({ impersonation: null })
  }

  if (status !== 'authenticated' || !isSysAdminAccount) {
    return null
  }

  const imp = session.user.impersonation

  return (
    <div className="flex flex-col gap-1.5 mb-1">
      {imp && (
        <div
          className="rounded-sm border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] text-amber-950 leading-snug"
          role="status"
        >
          <div className="font-semibold text-amber-900">Impersonando</div>
          <div className="truncate mt-0.5">
            {imp.name} · {imp.email}
          </div>
          <div className="mt-1.5">
            <Button type="button" variant="secondary" size="xs" onClick={() => void handleStopImpersonation()}>
              Volver a sys-admin
            </Button>
          </div>
        </div>
      )}

      <button
        type="button"
        title={imp ? 'Cambiar de usuario impersonado' : 'Impersonar otro usuario'}
        onClick={() => {
          setError(null)
          setModalOpen(true)
        }}
        className={cn(
          'flex w-full items-center gap-2.5 h-[34px] px-2 rounded-sm text-[13px] mb-px transition-colors text-left cursor-pointer',
          'text-zinc-700 hover:bg-zinc-100',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-0',
        )}
      >
        <span className="flex-shrink-0 text-zinc-400">
          <ImpersonateActionIcon />
        </span>
        <span className="truncate">{imp ? 'Cambiar usuario' : 'Impersonar usuario'}</span>
      </button>

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
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
          {loading && trimmedQuery.length >= 2 && (
            <p className="text-[11px] text-zinc-500">Buscando…</p>
          )}
          {!loading && trimmedQuery.length >= 2 && displayHits.length === 0 && (
            <p className="text-[11px] text-zinc-500">Sin resultados.</p>
          )}
          <ul className="max-h-[240px] overflow-y-auto divide-y divide-zinc-100 rounded-sm border border-zinc-200">
            {displayHits.map(h => (
              <li key={h.id}>
                <button
                  type="button"
                  disabled={!!submittingId}
                  onClick={() => void handleImpersonate(h.id)}
                  className="w-full text-left px-3 py-2 text-[13px] hover:bg-zinc-50 disabled:opacity-50"
                >
                  <div className="font-medium text-zinc-900">{h.name}</div>
                  <div className="text-[11px] text-zinc-500">{h.email}</div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">{h.role}</div>
                </button>
              </li>
            ))}
          </ul>
          {error && (
            <p role="alert" className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
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
