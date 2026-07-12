'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/primitives/Button'
import { Checkbox } from '@/components/primitives/Checkbox'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

interface OrgUser {
  id: string
  email: string
  name: string
  is_active: boolean
}

export function AlertasTab() {
  const [users, setUsers] = useState<OrgUser[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setServerError(null)
      try {
        const [usersRes, configRes] = await Promise.all([
          fetchJson<{ data: OrgUser[] }>('/api/v1/settings/users'),
          fetchJson<{ recipient_user_ids: string[] }>('/api/v1/inventory/low-stock-alerts/config'),
        ])
        if (cancelled) return
        setUsers(usersRes.data.filter(u => u.is_active))
        setSelected(new Set(configRes.recipient_user_ids))
      } catch (e) {
        if (cancelled) return
        setServerError(getApiErrorMessage(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refresh])

  function toggle(userId: string, checked: boolean) {
    setSelected(prev => {
      const next = new Set(prev)
      if (checked) next.add(userId)
      else next.delete(userId)
      return next
    })
    setSavedMsg(null)
  }

  async function handleSave() {
    setSaving(true)
    setServerError(null)
    setSavedMsg(null)
    try {
      await fetchJson('/api/v1/inventory/low-stock-alerts/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_user_ids: Array.from(selected) }),
      })
      setSavedMsg('Destinatarios guardados.')
      setRefresh(r => r + 1)
    } catch (e) {
      setServerError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-fg-muted">Cargando…</p>
  if (!users) return <p className="text-sm text-danger">{serverError ?? 'No se pudo cargar la configuración.'}</p>

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-[13px] text-fg-muted">
          Elegí qué usuarios reciben un email cuando el stock de un producto cae por debajo del mínimo configurado.
        </p>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>

      <div className="rounded-sm border border-border bg-surface p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-fg-muted">
          Alerta de stock bajo
        </p>
        {users.length === 0 ? (
          <p className="text-[13px] text-fg-subtle">No hay usuarios activos en la organización.</p>
        ) : (
          <ul className="space-y-2">
            {users.map(user => (
              <li key={user.id}>
                <Checkbox
                  checked={selected.has(user.id)}
                  onCheckedChange={v => toggle(user.id, v === true)}
                  label={`${user.name} (${user.email})`}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {serverError ? <p className="text-sm text-danger">{serverError}</p> : null}
      {savedMsg ? <p className="text-sm text-success">{savedMsg}</p> : null}
    </div>
  )
}
