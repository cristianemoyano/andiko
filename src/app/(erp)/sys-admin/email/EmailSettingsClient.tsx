'use client'

import { useEffect, useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { PasswordInput } from '@/components/primitives/PasswordInput'
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

const ENDPOINT = '/api/v1/sys-admin/email-settings'
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function EmailSettingsClient() {
  const [form, setForm] = useState<PublicEmailSettings | null>(null)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)

  const [testEmail, setTestEmail] = useState('')
  const [testing, setTesting] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)
  const [testMsg, setTestMsg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setServerError(null)
      try {
        const body = await fetchJson<PublicEmailSettings>(ENDPOINT)
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

  /**
   * Prefill the SMTP fields for a personal Gmail account (smtp.gmail.com, 465,
   * SSL). Gmail requires the sender to match the authenticated account, so we
   * sync user ↔ from_address from whichever is already filled.
   */
  function applyGmailPreset() {
    setForm(f => {
      if (!f) return f
      const account = f.user.trim() || f.from_address.trim()
      return {
        ...f,
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        user: f.user.trim() || account,
        from_address: f.from_address.trim() || account,
      }
    })
    setErrors({})
    setSavedMsg(null)
  }

  /** Prefill SMTP for the self-hosted docker-mailserver on production Swarm. */
  function applyAndikoMailPreset() {
    setForm(f =>
      f
        ? {
            ...f,
            host: 'mailserver',
            port: 587,
            secure: false,
            user: 'erp@andiko.cloud',
            from_address: 'erp@andiko.cloud',
            from_name: f.from_name.trim() || 'Andiko',
          }
        : f,
    )
    setErrors({})
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
      const body = await fetchJson<PublicEmailSettings>(ENDPOINT, {
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

  async function handleSendTest() {
    setTestError(null)
    setTestMsg(null)
    const to = testEmail.trim()
    if (!EMAIL.test(to)) {
      setTestError('Ingresá una dirección de correo válida.')
      return
    }

    setTesting(true)
    try {
      const result = await fetchJson<{ transport: 'smtp' | 'log'; recipient: string }>(
        `${ENDPOINT}/test`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to }),
        },
      )
      setTestMsg(`Email de prueba enviado a ${result.recipient}.`)
    } catch (e) {
      setTestError(getApiErrorMessage(e))
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Sys-admin' }, { label: 'Email (SMTP)' }]}
        actions={
          <Button type="button" onClick={handleSave} disabled={loading || saving || !form}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        }
      />

      <PageBody padding="p-6">
        {loading ? (
          <p className="text-sm text-fg-muted">Cargando…</p>
        ) : !form ? (
          <p className="text-sm text-danger">{serverError ?? 'No se pudo cargar la configuración.'}</p>
        ) : (
          <div className="max-w-xl space-y-5">
            <p className="text-[13px] text-fg-muted">
              Configuración de email <strong>a nivel plataforma</strong>: la usan todas las organizaciones para
              enviar documentos. Sin esta configuración, los envíos quedan registrados pero no se entregan. El
              contenido de los emails se define por organización en Configuración → Plantillas de email.
            </p>

            <section className="rounded-sm border border-border bg-surface p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-fg">Envío de emails habilitado</p>
                  <p className="text-xs text-fg-muted">Activá para entregar documentos por SMTP.</p>
                </div>
                <Switch
                  checked={form.enabled}
                  onCheckedChange={v => update('enabled', v)}
                  aria-label="Habilitar envío de emails"
                />
              </div>
            </section>

            <section className="rounded-sm border border-border bg-surface p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-semibold text-fg">Servidor SMTP</h2>
                <div className="flex flex-wrap gap-2 justify-end">
                  <Button type="button" variant="secondary" size="xs" onClick={applyAndikoMailPreset}>
                    Servidor Andiko
                  </Button>
                  <Button type="button" variant="secondary" size="xs" onClick={applyGmailPreset}>
                    Usar Gmail
                  </Button>
                </div>
              </div>
              <p className="text-xs text-fg-muted">
                En producción, <strong>Servidor Andiko</strong> usa el host interno{' '}
                <code className="text-xs">mailserver:587</code> (red Swarm). STARTTLS valida el
                certificado de <code className="text-xs">mail.andiko.cloud</code> automáticamente.
                Guardá la contraseña de <code className="text-xs">erp@andiko.cloud</code> creada con{' '}
                <code className="text-xs">make prod-mail-add-user</code>. Para Gmail personal, tocá{' '}
                <strong>Usar Gmail</strong> y usá{' '}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-600 underline underline-offset-2 hover:text-brand-700"
                >
                  una contraseña de aplicación
                </a>{' '}
                (con verificación en 2 pasos activada): tu contraseña habitual de Gmail no funciona
                por SMTP.
              </p>

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
                  <p className="text-[13px] text-fg-muted">Conexión segura (SSL/TLS)</p>
                  <p className="text-xs text-fg-subtle">Activá para puerto 465. Para 587 (STARTTLS) dejalo desactivado.</p>
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
                <PasswordInput
                  id="smtp_password"
                  value={password}
                  error={!!errors.password}
                  placeholder={form.has_password ? '••••••••' : 'Contraseña o app password'}
                  onChange={e => setPassword(e.target.value)}
                />
                {form.has_password ? (
                  <p className="mt-1 text-xs text-fg-subtle">Hay una contraseña guardada. Dejá vacío para mantenerla.</p>
                ) : null}
              </FormField>
            </section>

            <section className="rounded-sm border border-border bg-surface p-4 space-y-4">
              <h2 className="text-sm font-semibold text-fg">Remitente</h2>

              <FormField label="Nombre del remitente" htmlFor="from_name" error={errors.from_name}>
                <Input
                  id="from_name"
                  value={form.from_name}
                  error={!!errors.from_name}
                  placeholder="Andiko ERP"
                  onChange={e => update('from_name', e.target.value)}
                />
              </FormField>

              <FormField label="Email del remitente" htmlFor="from_address" error={errors.from_address}>
                <Input
                  id="from_address"
                  value={form.from_address}
                  error={!!errors.from_address}
                  placeholder="no-reply@andiko.app"
                  onChange={e => update('from_address', e.target.value)}
                />
              </FormField>
            </section>

            <section className="rounded-sm border border-border bg-surface p-4 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-fg">Probar configuración</h2>
                <p className="mt-1 text-xs text-fg-muted">
                  Envía un email de prueba con la configuración <strong>guardada</strong>. Guardá los
                  cambios antes de probar.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 sm:items-end">
                <FormField label="Enviar prueba a" htmlFor="test_email">
                  <Input
                    id="test_email"
                    type="email"
                    value={testEmail}
                    placeholder="tu@correo.com"
                    onChange={e => {
                      setTestEmail(e.target.value)
                      setTestError(null)
                      setTestMsg(null)
                    }}
                  />
                </FormField>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleSendTest}
                  disabled={testing || saving || !testEmail.trim()}
                >
                  {testing ? 'Enviando…' : 'Enviar email de prueba'}
                </Button>
              </div>

              {testError ? <p className="text-sm text-danger">{testError}</p> : null}
              {testMsg ? <p className="text-sm text-success">{testMsg}</p> : null}
            </section>

            {serverError ? <p className="text-sm text-danger">{serverError}</p> : null}
            {savedMsg ? <p className="text-sm text-success">{savedMsg}</p> : null}
          </div>
        )}
      </PageBody>
    </div>
  )
}
