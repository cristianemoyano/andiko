'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/primitives/Button'
import { Textarea } from '@/components/primitives/Textarea'
import { FormField } from '@/components/primitives/FormField'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

interface TermsAndConditionsResponse {
  org_id: string
  terms_and_conditions: string | null
}

const MAX_LENGTH = 20000

export function TermsAndConditionsTab() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setServerError(null)
      try {
        const body = await fetchJson<TermsAndConditionsResponse>('/api/v1/organization/terms-and-conditions')
        if (cancelled) return
        setText(body.terms_and_conditions ?? '')
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

  function validate(value: string): string | null {
    if (value.length > MAX_LENGTH) return `Máximo ${MAX_LENGTH} caracteres`
    return null
  }

  async function handleSave() {
    const validationError = validate(text)
    setError(validationError)
    if (validationError) return

    setSaving(true)
    setServerError(null)
    setSavedMsg(null)
    try {
      await fetchJson('/api/v1/organization/terms-and-conditions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ terms_and_conditions: text.trim() || null }),
      })
      setSavedMsg('Términos y condiciones guardados.')
      setRefresh(r => r + 1)
    } catch (e) {
      setServerError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-fg-muted">Cargando…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[13px] text-fg-muted">
          Este texto se puede incluir al pie de presupuestos, pedidos, facturas y otros documentos impresos.
        </p>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>

      <section className="rounded-sm border border-border bg-surface p-4 space-y-3 max-w-2xl">
        <h2 className="text-sm font-semibold text-fg">Términos y condiciones</h2>
        <FormField label="Texto" htmlFor="terms_and_conditions" error={error ?? undefined}>
          <Textarea
            id="terms_and_conditions"
            value={text}
            error={!!error}
            rows={16}
            placeholder="Ej: Los precios no incluyen envío. La mercadería viaja por cuenta y riesgo del comprador…"
            onChange={e => { setText(e.target.value); setSavedMsg(null) }}
          />
        </FormField>
        <p className="text-xs text-fg-subtle">{text.length}/{MAX_LENGTH} caracteres</p>
      </section>

      {serverError ? <p className="text-sm text-danger">{serverError}</p> : null}
      {savedMsg ? <p className="text-sm text-success">{savedMsg}</p> : null}
    </div>
  )
}
