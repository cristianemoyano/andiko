'use client'

import { useEffect, useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Textarea } from '@/components/primitives/Textarea'
import { Select } from '@/components/primitives/Select'
import { FormField } from '@/components/primitives/FormField'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { BillingSubNav } from '../BillingSubNav'

/** API shape — every field nullable. */
interface BillerSettings {
  legal_name: string | null
  cuit: string | null
  iva_condition: string | null
  fiscal_address: string | null
  gross_income: string | null
  activity_start_date: string | null
  email: string | null
  phone: string | null
}

/** Form shape — nulls normalized to empty strings for controlled inputs. */
type BillerForm = { [K in keyof BillerSettings]: string }

const ENDPOINT = '/api/v1/sys-admin/billing/issuer'
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CUIT = /^\d{2}-?\d{8}-?\d$/

const IVA_CONDITION_OPTIONS = [
  { value: 'responsable_inscripto', label: 'Responsable Inscripto' },
  { value: 'monotributista', label: 'Monotributista' },
  { value: 'exento', label: 'Exento' },
  { value: 'no_responsable', label: 'No Responsable' },
  { value: 'consumidor_final', label: 'Consumidor Final' },
]

const EMPTY: BillerForm = {
  legal_name: '', cuit: '', iva_condition: '', fiscal_address: '',
  gross_income: '', activity_start_date: '', email: '', phone: '',
}

function normalize(b: BillerSettings): BillerForm {
  return {
    legal_name: b.legal_name ?? '',
    cuit: b.cuit ?? '',
    iva_condition: b.iva_condition ?? '',
    fiscal_address: b.fiscal_address ?? '',
    gross_income: b.gross_income ?? '',
    activity_start_date: b.activity_start_date ?? '',
    email: b.email ?? '',
    phone: b.phone ?? '',
  }
}

export function EmisorClient() {
  const [form, setForm] = useState<BillerForm | null>(null)
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
        const body = await fetchJson<BillerSettings>(ENDPOINT)
        if (cancelled) return
        setForm(normalize(body))
      } catch (e) {
        if (cancelled) return
        setForm(normalize(EMPTY))
        setServerError(getApiErrorMessage(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [refresh])

  function update<K extends keyof BillerForm>(key: K, value: string) {
    setForm(f => (f ? { ...f, [key]: value } : f))
    setSavedMsg(null)
  }

  function validate(f: BillerForm): Record<string, string> {
    const next: Record<string, string> = {}
    if (f.cuit && !CUIT.test(f.cuit)) next.cuit = 'CUIT inválido (XX-XXXXXXXX-X)'
    if (f.email && !EMAIL.test(f.email)) next.email = 'Email inválido'
    if (f.activity_start_date && !/^\d{4}-\d{2}-\d{2}$/.test(f.activity_start_date)) {
      next.activity_start_date = 'Fecha inválida (AAAA-MM-DD)'
    }
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
      const body = await fetchJson<BillerSettings>(ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legal_name: form.legal_name.trim(),
          cuit: form.cuit.trim(),
          iva_condition: form.iva_condition,
          fiscal_address: form.fiscal_address.trim(),
          gross_income: form.gross_income.trim(),
          activity_start_date: form.activity_start_date.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
        }),
      })
      setForm(normalize(body))
      setSavedMsg('Datos del emisor guardados.')
      setRefresh(r => r + 1)
    } catch (e) {
      setServerError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Facturación', href: '/sys-admin/billing' }, { label: 'Datos del emisor' }]}
        actions={
          <Button type="button" onClick={handleSave} disabled={loading || saving || !form}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        }
      />

      <BillingSubNav />

      <PageBody padding="p-6">
        {loading ? (
          <p className="text-sm text-fg-muted">Cargando…</p>
        ) : !form ? (
          <p className="text-sm text-danger">{serverError ?? 'No se pudo cargar la configuración.'}</p>
        ) : (
          <div className="max-w-xl space-y-5">
            <p className="text-[13px] text-fg-muted">
              Datos fiscales de <strong>la plataforma como emisor</strong>. Son los que figuran como emisor en las
              facturas de suscripción que se cobran a las organizaciones.
            </p>

            <section className="rounded-sm border border-border bg-surface p-4 space-y-4">
              <h2 className="text-sm font-semibold text-fg">Identidad fiscal</h2>

              <FormField label="Razón social" htmlFor="legal_name" error={errors.legal_name}>
                <Input
                  id="legal_name"
                  value={form.legal_name}
                  placeholder="Andiko S.A."
                  onChange={e => update('legal_name', e.target.value)}
                />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="CUIT" htmlFor="cuit" error={errors.cuit}>
                  <Input
                    id="cuit"
                    value={form.cuit}
                    error={!!errors.cuit}
                    placeholder="30-12345678-9"
                    onChange={e => update('cuit', e.target.value)}
                  />
                </FormField>
                <FormField label="Condición IVA" htmlFor="iva_condition">
                  <Select
                    id="iva_condition"
                    value={form.iva_condition}
                    onChange={v => update('iva_condition', v)}
                    options={IVA_CONDITION_OPTIONS}
                    placeholder="Seleccionar…"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Ingresos Brutos" htmlFor="gross_income">
                  <Input
                    id="gross_income"
                    value={form.gross_income}
                    placeholder="901-234567-8"
                    onChange={e => update('gross_income', e.target.value)}
                  />
                </FormField>
                <FormField label="Inicio de actividades" htmlFor="activity_start_date" error={errors.activity_start_date}>
                  <Input
                    id="activity_start_date"
                    type="date"
                    value={form.activity_start_date}
                    error={!!errors.activity_start_date}
                    onChange={e => update('activity_start_date', e.target.value)}
                  />
                </FormField>
              </div>
            </section>

            <section className="rounded-sm border border-border bg-surface p-4 space-y-4">
              <h2 className="text-sm font-semibold text-fg">Domicilio y contacto</h2>

              <FormField label="Domicilio fiscal" htmlFor="fiscal_address">
                <Textarea
                  id="fiscal_address"
                  value={form.fiscal_address}
                  placeholder="Av. Siempreviva 742, CABA"
                  rows={2}
                  onChange={e => update('fiscal_address', e.target.value)}
                />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Email" htmlFor="email" error={errors.email}>
                  <Input
                    id="email"
                    value={form.email}
                    error={!!errors.email}
                    placeholder="facturacion@andiko.app"
                    onChange={e => update('email', e.target.value)}
                  />
                </FormField>
                <FormField label="Teléfono" htmlFor="phone">
                  <Input
                    id="phone"
                    value={form.phone}
                    placeholder="+54 11 5555-5555"
                    onChange={e => update('phone', e.target.value)}
                  />
                </FormField>
              </div>
            </section>

            {serverError ? <p className="text-sm text-danger">{serverError}</p> : null}
            {savedMsg ? <p className="text-sm text-success">{savedMsg}</p> : null}
          </div>
        )}
      </PageBody>
    </div>
  )
}
