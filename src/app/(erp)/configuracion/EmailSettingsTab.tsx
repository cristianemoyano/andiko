'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { FormField } from '@/components/primitives/FormField'
import { Switch } from '@/components/primitives/Switch'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

interface PublicEmailSettings {
  enabled: boolean
  host: string
  port: number
  secure: boolean
  user: string
  from_name: string
  from_address: string
  has_password: boolean
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function EmailSettingsTab() {
  const [form, setForm] = useState<PublicEmailSettings | null>(null)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setServerError(null)
      try {
        const body = await fetchJson<PublicEmailSettings>('/api/v1/communications/settings')
        if (cancelled) return
        setForm(body)
        setPassword('')
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

  function update<K extends keyof PublicEmailSettings>(key: K, value: PublicEmailSettings[K]) {
    setForm(f => (f ? { ...f, [key]: value } : f))
    setSavedMsg(null)
  }

  function validate(f: PublicEmailSettings): Record<string, string> {
    const next: Record<string, string> = {}
    if (f.enabled) {
      if (!f.host.trim()) next.host = 'El servidor SMTP es obligatorio'
      if (!f.from_name.trim()) next.from_name = 'El nombre del remitente es obligatorio'
      if (!EMAIL.test(f.from_address)) next.from_address = 'Dirección de correo inválida'
      if (!f.has_password && !password) next.password = 'La contraseña es obligatoria para enviar'
    }
    if (f.from_address && !EMAIL.test(f.from_address)) next.from_address = 'Dirección de correo inválida'
    if (f.port < 1 || f.port > 65535) next.port = 'Puerto inválido (1–65535)'
    return next
  }

  async function handleSave() {
    if (!form) return
    const v = validate(form)
    setErrors(v)
    if (Object.keys(v).length > 0) return

    setSaving(true)
    setServerError(null)
    setSavedMsg(null)
    try {
      const body = await fetchJson<PublicEmailSettings>('/api/v1/communications/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: form.enabled,
          host: form.host.trim(),
          port: form.port,
          secure: form.secure,
          user: form.user.trim(),
          from_name: form.from_name.trim(),
          from_address: form.from_address.trim(),
          // Empty → keep existing password.
          ...(password ? { password } : {}),
        }),
      })
      setForm(body)
      setPassword('')
      setSavedMsg('Configuración guardada.')
      setRefresh(r => r + 1)
    } catch (e) {
      setServerError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-zinc-500">Cargando…</p>
  if (!form) return <p className="text-sm text-red-700">{serverError ?? 'No se pudo cargar la configuración.'}</p>

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <p className="text-[13px] text-zinc-500">
          Configurá el servidor SMTP de tu organización para enviar documentos por email.
          Sin esta configuración, los envíos quedan registrados pero no se entregan.
        </p>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>

      <section className="rounded-sm border border-zinc-200 bg-white p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-900">Envío de emails habilitado</p>
            <p className="text-xs text-zinc-500">Activá para entregar documentos por SMTP.</p>
          </div>
          <Switch checked={form.enabled} onCheckedChange={v => update('enabled', v)} aria-label="Habilitar envío de emails" />
        </div>
      </section>

      <section className="rounded-sm border border-zinc-200 bg-white p-4 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-900">Servidor SMTP</h2>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-4">
          <FormField label="Host" htmlFor="host" error={errors.host}>
            <Input
              id="host"
              value={form.host}
              error={!!errors.host}
              placeholder="smtp.gmail.com"
              onChange={e => update('host', e.target.value)}
            />
          </FormField>
          <FormField label="Puerto" htmlFor="port" error={errors.port}>
            <Input
              id="port"
              type="number"
              value={String(form.port)}
              error={!!errors.port}
              onChange={e => update('port', parseInt(e.target.value, 10) || 0)}
            />
          </FormField>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] text-zinc-700">Conexión segura (SSL/TLS)</p>
            <p className="text-xs text-zinc-400">Activá para puerto 465. Para 587 (STARTTLS) dejalo desactivado.</p>
          </div>
          <Switch checked={form.secure} onCheckedChange={v => update('secure', v)} aria-label="Conexión segura" />
        </div>

        <FormField label="Usuario" htmlFor="smtp_user">
          <Input
            id="smtp_user"
            value={form.user}
            placeholder="usuario@dominio.com"
            onChange={e => update('user', e.target.value)}
          />
        </FormField>

        <FormField label="Contraseña" htmlFor="smtp_password" error={errors.password}>
          <Input
            id="smtp_password"
            type="password"
            value={password}
            error={!!errors.password}
            placeholder={form.has_password ? '••••••••' : 'Contraseña o app password'}
            onChange={e => setPassword(e.target.value)}
          />
          {form.has_password ? (
            <p className="mt-1 text-xs text-zinc-400">Hay una contraseña guardada. Dejá vacío para mantenerla.</p>
          ) : null}
        </FormField>
      </section>

      <section className="rounded-sm border border-zinc-200 bg-white p-4 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-900">Remitente</h2>

        <FormField label="Nombre del remitente" htmlFor="from_name" error={errors.from_name}>
          <Input
            id="from_name"
            value={form.from_name}
            error={!!errors.from_name}
            placeholder="Mi Empresa S.A."
            onChange={e => update('from_name', e.target.value)}
          />
        </FormField>

        <FormField label="Email del remitente" htmlFor="from_address" error={errors.from_address}>
          <Input
            id="from_address"
            value={form.from_address}
            error={!!errors.from_address}
            placeholder="ventas@miempresa.com"
            onChange={e => update('from_address', e.target.value)}
          />
        </FormField>
      </section>

      {serverError ? <p className="text-sm text-red-700">{serverError}</p> : null}
      {savedMsg ? <p className="text-sm text-green-700">{savedMsg}</p> : null}
    </div>
  )
}
