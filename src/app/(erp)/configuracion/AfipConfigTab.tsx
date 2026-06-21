'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Textarea } from '@/components/primitives/Textarea'
import { Select } from '@/components/primitives/Select'
import { FormField } from '@/components/primitives/FormField'
import { Badge } from '@/components/primitives/Badge'
import { DataTable, ConfirmDialog, type Column } from '@/components/erp'
import { fetchJson, getApiErrorMessage, isApiRequestError } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'

type Environment = 'homologacion' | 'produccion'

const ENVIRONMENT_LABEL: Record<Environment, string> = {
  homologacion: 'Homologación',
  produccion: 'Producción',
}

const ENVIRONMENT_OPTIONS = [
  { value: 'homologacion', label: 'Homologación' },
  { value: 'produccion', label: 'Producción' },
]

const ORG_IVA_OPTIONS = [
  { value: 'responsable_inscripto', label: 'Responsable inscripto' },
  { value: 'monotributista', label: 'Monotributista' },
  { value: 'exento', label: 'Exento' },
  { value: 'consumidor_final', label: 'Consumidor final' },
  { value: 'no_responsable', label: 'No responsable' },
]

// ── Section 0: Datos fiscales de la empresa (emisor) ─────────────────────────

type OrgFiscal = {
  legal_name: string | null
  cuit: string | null
  iva_condition: string | null
  fiscal_address: string | null
  gross_income: string | null
  activity_start_date: string | null
}

function DatosFiscalesSection() {
  const [saved, setSaved] = useState<OrgFiscal | null>(null)
  const [legalName, setLegalName] = useState('')
  const [cuit, setCuit] = useState('')
  const [ivaCondition, setIvaCondition] = useState('')
  const [fiscalAddress, setFiscalAddress] = useState('')
  const [grossIncome, setGrossIncome] = useState('')
  const [activityStartDate, setActivityStartDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setLoadError('')
      try {
        const data = await fetchJson<{ organization: OrgFiscal }>('/api/v1/afip/config')
        if (cancelled) return
        const org = data.organization
        setSaved(org)
        setLegalName(org.legal_name ?? '')
        setCuit(org.cuit ?? '')
        setIvaCondition(org.iva_condition ?? '')
        setFiscalAddress(org.fiscal_address ?? '')
        setGrossIncome(org.gross_income ?? '')
        setActivityStartDate(org.activity_start_date ?? '')
      } catch (e) {
        if (!cancelled) setLoadError(getApiErrorMessage(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!justSaved) return
    const timer = window.setTimeout(() => setJustSaved(false), 2000)
    return () => window.clearTimeout(timer)
  }, [justSaved])

  const dirty = saved != null && (
    legalName !== (saved.legal_name ?? '') ||
    cuit !== (saved.cuit ?? '') ||
    ivaCondition !== (saved.iva_condition ?? '') ||
    fiscalAddress !== (saved.fiscal_address ?? '') ||
    grossIncome !== (saved.gross_income ?? '') ||
    activityStartDate !== (saved.activity_start_date ?? '')
  )

  async function save() {
    setSaving(true)
    setServerError('')
    setErrors({})
    try {
      const updated = await fetchJson<OrgFiscal>('/api/v1/afip/fiscal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legal_name: legalName.trim(),
          cuit: cuit.trim(),
          iva_condition: ivaCondition || undefined,
          fiscal_address: fiscalAddress.trim() || null,
          gross_income: grossIncome.trim() || null,
          activity_start_date: activityStartDate.trim() || null,
        }),
      })
      setSaved(updated)
      setLegalName(updated.legal_name ?? '')
      setCuit(updated.cuit ?? '')
      setIvaCondition(updated.iva_condition ?? '')
      setFiscalAddress(updated.fiscal_address ?? '')
      setGrossIncome(updated.gross_income ?? '')
      setActivityStartDate(updated.activity_start_date ?? '')
      setJustSaved(true)
      notifySuccess('Datos fiscales guardados')
    } catch (e) {
      if (isApiRequestError(e) && e.details && typeof e.details === 'object') {
        const fieldErrors = (e.details as { fieldErrors?: Record<string, string[]> }).fieldErrors
        if (fieldErrors) {
          setErrors(Object.fromEntries(Object.entries(fieldErrors).map(([k, v]) => [k, v[0] ?? ''])))
        }
      }
      setServerError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const missingForAfip = !loading && saved && (!saved.iva_condition || !saved.cuit || !saved.legal_name)

  return (
    <section className="rounded-sm border border-border bg-surface p-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-fg">Datos fiscales de tu empresa</h2>
        <p className="mt-0.5 text-[12px] text-fg-muted">
          Son los datos del emisor de las facturas (tu organización). La condición IVA del cliente no aplica acá.
        </p>
      </div>

      {missingForAfip && (
        <div className="rounded-sm border border-warning bg-warning-bg px-3 py-2 text-[12px] text-warning">
          Completá razón social, CUIT y condición IVA para poder autorizar comprobantes en AFIP.
        </div>
      )}

      {loading && <p className="text-[13px] text-fg-subtle">Cargando…</p>}
      {loadError && <p className="text-[13px] text-danger">{loadError}</p>}

      {!loading && !loadError && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Razón social" htmlFor="afip-org-legal-name" error={errors.legal_name}>
              <Input
                id="afip-org-legal-name"
                value={legalName}
                onChange={e => setLegalName(e.target.value)}
                error={!!errors.legal_name}
                placeholder="Ej: Mi Empresa S.A."
              />
            </FormField>
            <FormField label="CUIT" htmlFor="afip-org-cuit" error={errors.cuit}>
              <Input
                id="afip-org-cuit"
                value={cuit}
                onChange={e => setCuit(e.target.value)}
                error={!!errors.cuit}
                placeholder="30-12345678-9"
                className="font-mono"
              />
            </FormField>
            <FormField label="Condición IVA (emisor)" htmlFor="afip-org-iva" error={errors.iva_condition}>
              <Select
                value={ivaCondition}
                onChange={setIvaCondition}
                options={ORG_IVA_OPTIONS}
                placeholder="Seleccioná…"
              />
            </FormField>
            <FormField label="Domicilio fiscal" htmlFor="afip-org-address" error={errors.fiscal_address}>
              <Input
                id="afip-org-address"
                value={fiscalAddress}
                onChange={e => setFiscalAddress(e.target.value)}
                error={!!errors.fiscal_address}
                placeholder="Calle, ciudad, provincia"
              />
            </FormField>
            <FormField label="Ingresos brutos" htmlFor="afip-org-gross-income" error={errors.gross_income}>
              <Input
                id="afip-org-gross-income"
                value={grossIncome}
                onChange={e => setGrossIncome(e.target.value)}
                error={!!errors.gross_income}
                placeholder="Ej: 901-234567-8"
              />
            </FormField>
            <FormField label="Inicio de actividades" htmlFor="afip-org-activity-start" error={errors.activity_start_date}>
              <Input
                id="afip-org-activity-start"
                type="date"
                value={activityStartDate}
                onChange={e => setActivityStartDate(e.target.value)}
                error={!!errors.activity_start_date}
              />
            </FormField>
          </div>

          {serverError && <p className="text-[13px] text-danger">{serverError}</p>}

          <div className="flex items-center gap-3">
            <Button type="button" size="sm" disabled={saving || !dirty} onClick={save}>
              {saving ? 'Guardando…' : 'Guardar datos fiscales'}
            </Button>
            {justSaved && !dirty && <span className="text-[12px] text-success">Guardado</span>}
          </div>
        </>
      )}
    </section>
  )
}

// ── Section 1b: Pie del ticket POS ───────────────────────────────────────────

type PosTicketConfig = {
  consumer_defense_line: string | null
}

function PieTicketPosSection() {
  const [saved, setSaved] = useState<PosTicketConfig | null>(null)
  const [consumerDefenseLine, setConsumerDefenseLine] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setLoadError('')
      try {
        const data = await fetchJson<{ data: PosTicketConfig }>('/api/v1/pos/ticket-config')
        if (cancelled) return
        const ticket = data.data ?? { consumer_defense_line: null }
        setSaved(ticket)
        setConsumerDefenseLine(ticket.consumer_defense_line ?? '')
      } catch (e) {
        if (!cancelled) setLoadError(getApiErrorMessage(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!justSaved) return
    const timer = window.setTimeout(() => setJustSaved(false), 2000)
    return () => window.clearTimeout(timer)
  }, [justSaved])

  const dirty = saved != null && consumerDefenseLine !== (saved.consumer_defense_line ?? '')

  async function save() {
    setSaving(true)
    setServerError('')
    setErrors({})
    try {
      const updated = await fetchJson<{ data: PosTicketConfig }>('/api/v1/pos/ticket-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consumer_defense_line: consumerDefenseLine.trim() || null,
        }),
      })
      setSaved(updated.data)
      setConsumerDefenseLine(updated.data.consumer_defense_line ?? '')
      setJustSaved(true)
      notifySuccess('Pie del ticket guardado')
    } catch (e) {
      if (isApiRequestError(e) && e.details && typeof e.details === 'object') {
        const fieldErrors = (e.details as { fieldErrors?: Record<string, string[]> }).fieldErrors
        if (fieldErrors) {
          setErrors(Object.fromEntries(Object.entries(fieldErrors).map(([k, v]) => [k, v[0] ?? ''])))
        }
      }
      setServerError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-sm border border-border bg-surface p-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-fg">Pie del ticket POS</h2>
        <p className="mt-0.5 text-[12px] text-fg-muted">
          Leyenda de defensa del consumidor impresa en cada ticket. Si la dejás vacía, el POS usa el texto
          nacional por defecto.
        </p>
      </div>

      {loading && <p className="text-[13px] text-fg-subtle">Cargando…</p>}
      {loadError && <p className="text-[13px] text-danger">{loadError}</p>}

      {!loading && !loadError && (
        <>
          <FormField
            label="Defensa del consumidor"
            htmlFor="pos-ticket-consumer-defense"
            error={errors.consumer_defense_line}
          >
            <Textarea
              id="pos-ticket-consumer-defense"
              value={consumerDefenseLine}
              onChange={e => setConsumerDefenseLine(e.target.value)}
              error={!!errors.consumer_defense_line}
              rows={3}
              placeholder="Ej: Defensa del Consumidor CABA — Tel. 147"
            />
          </FormField>

          {serverError && <p className="text-[13px] text-danger">{serverError}</p>}

          <div className="flex items-center gap-3">
            <Button type="button" size="sm" disabled={saving || !dirty} onClick={save}>
              {saving ? 'Guardando…' : 'Guardar pie del ticket'}
            </Button>
            {justSaved && !dirty && <span className="text-[12px] text-success">Guardado</span>}
          </div>
        </>
      )}
    </section>
  )
}

// ── Section 2: Puntos de venta ───────────────────────────────────────────────

type AfipConfig = {
  environment: string
  certificateConfigured: boolean
  organization: {
    cuit: string | null
    iva_condition: string | null
    legal_name: string | null
    fiscal_address: string | null
    gross_income: string | null
    activity_start_date: string | null
  }
  branches: {
    id: string
    name: string
    branch_code: number
    punto_venta: number | null
    establishment_code: string | null
  }[]
}

type BranchPuntoVenta = {
  id: string
  punto_venta: number | null
  establishment_code: string | null
}

function draftForEstablishment(code: string | null): string {
  return code ?? ''
}

function isFormDirty(
  branches: AfipConfig['branches'],
  pvDrafts: Record<string, string>,
  estDrafts: Record<string, string>,
): boolean {
  return branches.some(b =>
    (pvDrafts[b.id] ?? '') !== draftForPuntoVenta(b.punto_venta) ||
    (estDrafts[b.id] ?? '') !== draftForEstablishment(b.establishment_code),
  )
}

function draftForPuntoVenta(puntoVenta: number | null): string {
  return puntoVenta != null ? String(puntoVenta) : ''
}

function PuntosDeVentaSection() {
  const [config, setConfig] = useState<AfipConfig | null>(null)
  const [pvDrafts, setPvDrafts] = useState<Record<string, string>>({})
  const [estDrafts, setEstDrafts] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setLoadError('')
      try {
        const data = await fetchJson<AfipConfig>('/api/v1/afip/config')
        if (cancelled) return
        setConfig(data)
        setPvDrafts(Object.fromEntries(data.branches.map(b => [b.id, draftForPuntoVenta(b.punto_venta)])))
        setEstDrafts(Object.fromEntries(data.branches.map(b => [b.id, draftForEstablishment(b.establishment_code)])))
        setErrors({})
      } catch (e) {
        if (cancelled) return
        setLoadError(getApiErrorMessage(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!saved) return
    const timer = window.setTimeout(() => setSaved(false), 2000)
    return () => window.clearTimeout(timer)
  }, [saved])

  async function saveAll() {
    if (!config) return

    const nextErrors: Record<string, string> = {}
    const payload: { branch_id: string; punto_venta: number; establishment_code: string | null }[] = []

    for (const b of config.branches) {
      const raw = pvDrafts[b.id]?.trim() ?? ''
      if (!raw) {
        nextErrors[`pv-${b.id}`] = 'Ingresá un punto de venta'
        continue
      }
      const pv = Number(raw)
      if (!Number.isInteger(pv) || pv <= 0 || pv > 99999) {
        nextErrors[`pv-${b.id}`] = 'Entero entre 1 y 99999'
        continue
      }
      const estRaw = estDrafts[b.id]?.trim() ?? ''
      payload.push({
        branch_id: b.id,
        punto_venta: pv,
        establishment_code: estRaw || null,
      })
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    try {
      const res = await fetchJson<{ branches: BranchPuntoVenta[] }>('/api/v1/afip/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branches: payload }),
      })

      const byId = new Map(res.branches.map(b => [b.id, b]))
      setConfig(prev => {
        if (!prev) return prev
        return {
          ...prev,
          branches: prev.branches.map(b => {
            const saved = byId.get(b.id)
            return saved
              ? { ...b, punto_venta: saved.punto_venta, establishment_code: saved.establishment_code }
              : b
          }),
        }
      })
      setPvDrafts(Object.fromEntries(
        config.branches.map(b => {
          const saved = byId.get(b.id)
          return [b.id, draftForPuntoVenta(saved?.punto_venta ?? b.punto_venta)]
        }),
      ))
      setEstDrafts(Object.fromEntries(
        config.branches.map(b => {
          const saved = byId.get(b.id)
          return [b.id, draftForEstablishment(saved?.establishment_code ?? b.establishment_code)]
        }),
      ))
      setSaved(true)
      notifySuccess('Puntos de venta guardados')
    } catch (e) {
      notifyApiError(e)
    } finally {
      setSaving(false)
    }
  }

  const dirty = config ? isFormDirty(config.branches, pvDrafts, estDrafts) : false

  return (
    <section className="rounded-sm border border-border bg-surface p-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-fg">Puntos de venta y establecimientos</h2>
        <p className="mt-0.5 text-[12px] text-fg-muted">
          Configurá el punto de venta AFIP y el código de establecimiento por sucursal. Cada terminal POS puede
          tener su propio PV en Dispositivos.
        </p>
      </div>

      {loading && <p className="text-[13px] text-fg-subtle">Cargando sucursales…</p>}
      {loadError && <p className="text-[13px] text-danger">{loadError}</p>}

      {config && !loading && (
        <>
          <div className="space-y-2">
            {config.branches.map(b => (
              <div key={b.id} className="flex flex-wrap items-end gap-3 border-b border-border pb-2 last:border-0">
                <div className="min-w-[180px] flex-1">
                  <p className="text-[13px] font-medium text-fg">{b.name}</p>
                  <p className="text-[11px] text-fg-subtle">Sucursal {String(b.branch_code).padStart(2, '0')}</p>
                </div>
                <FormField label="Punto de venta" htmlFor={`afip-pv-${b.id}`} error={errors[`pv-${b.id}`]}>
                  <Input
                    id={`afip-pv-${b.id}`}
                    type="text"
                    inputMode="numeric"
                    className="w-32"
                    value={pvDrafts[b.id] ?? ''}
                    error={!!errors[`pv-${b.id}`]}
                    onChange={e => {
                      const value = e.target.value.replace(/\D/g, '')
                      setPvDrafts(d => ({ ...d, [b.id]: value }))
                      setErrors(prev => {
                        const key = `pv-${b.id}`
                        if (!prev[key]) return prev
                        const next = { ...prev }
                        delete next[key]
                        return next
                      })
                    }}
                    placeholder="Ej: 3"
                  />
                </FormField>
                <FormField label="Establecimiento" htmlFor={`afip-est-${b.id}`}>
                  <Input
                    id={`afip-est-${b.id}`}
                    className="w-40"
                    value={estDrafts[b.id] ?? ''}
                    onChange={e => setEstDrafts(d => ({ ...d, [b.id]: e.target.value }))}
                    placeholder="Opcional"
                  />
                </FormField>
              </div>
            ))}
            {config.branches.length === 0 && <p className="text-[13px] text-fg-subtle">No hay sucursales activas.</p>}
          </div>

          {config.branches.length > 0 && (
            <div className="flex items-center gap-3 pt-1">
              <Button type="button" size="sm" disabled={saving || !dirty} onClick={saveAll}>
                {saving ? 'Guardando…' : 'Guardar puntos de venta'}
              </Button>
              {saved && !dirty && (
                <span className="text-[12px] text-success">Guardado</span>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}

// ── Section 2: Certificado ARCA ──────────────────────────────────────────────

type CredentialStatus = {
  environment: Environment
  cuit: string
  label: string | null
  expires_at: string | null
  is_active: boolean
}

function CertificadoSection() {
  const [credentials, setCredentials] = useState<CredentialStatus[]>([])
  const [refresh, setRefresh] = useState(0)

  const [environment, setEnvironment] = useState<Environment>('homologacion')
  const [cuit, setCuit] = useState('')
  const [cert, setCert] = useState('')
  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState<Environment | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchJson<{ credentials: CredentialStatus[] }>('/api/v1/afip/credentials')
      .then(data => { if (!cancelled) setCredentials(data.credentials ?? []) })
      .catch(e => { if (!cancelled) notifyApiError(e) })
    return () => { cancelled = true }
  }, [refresh])

  async function handleUpload() {
    const next: Record<string, string> = {}
    if (!/^\d{11}$/.test(cuit)) next.cuit = 'El CUIT debe tener 11 dígitos'
    if (!cert.includes('BEGIN CERTIFICATE')) next.cert = 'Pegá el certificado en formato PEM'
    if (!key.includes('PRIVATE KEY')) next.key = 'Pegá la clave privada en formato PEM'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    setServerError('')
    try {
      await fetchJson('/api/v1/afip/credentials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environment, cuit, cert, key, label: label.trim() || undefined }),
      })
      notifySuccess('Certificado guardado')
      setCert('')
      setKey('')
      setLabel('')
      setRefresh(r => r + 1)
    } catch (e) {
      setServerError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!toDelete) return
    try {
      await fetchJson(`/api/v1/afip/credentials?environment=${toDelete}`, { method: 'DELETE' })
      notifySuccess('Certificado eliminado')
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    } finally {
      setToDelete(null)
    }
  }

  return (
    <section className="rounded-sm border border-border bg-surface p-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-fg">Certificado ARCA</h2>
        <p className="mt-0.5 text-[12px] text-fg-muted">
          Cargá el certificado y la clave privada de tu organización. La clave se guarda cifrada y nunca se vuelve a mostrar.
        </p>
      </div>

      {credentials.length > 0 && (
        <div className="space-y-2">
          {credentials.map(c => (
            <div key={c.environment} className="flex flex-wrap items-center gap-3 rounded-sm border border-border bg-surface-muted px-3 py-2">
              <Badge status="info">{ENVIRONMENT_LABEL[c.environment]}</Badge>
              <span className="font-mono text-[12px] text-fg">{c.cuit}</span>
              {c.label && <span className="text-[12px] text-fg-muted">{c.label}</span>}
              <span className="text-[12px] text-fg-muted">
                {c.expires_at ? `Vence ${new Date(c.expires_at).toLocaleDateString('es-AR')}` : 'Sin vencimiento'}
              </span>
              <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setToDelete(c.environment)}>
                Quitar
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Entorno">
          <Select value={environment} onChange={v => setEnvironment(v as Environment)} options={ENVIRONMENT_OPTIONS} />
        </FormField>
        <FormField label="CUIT" error={errors.cuit}>
          <Input value={cuit} onChange={e => setCuit(e.target.value)} error={!!errors.cuit} placeholder="30123456780" />
        </FormField>
      </div>
      <FormField label="Certificado (PEM)" error={errors.cert}>
        <Textarea
          value={cert}
          onChange={e => setCert(e.target.value)}
          error={!!errors.cert}
          rows={6}
          className="font-mono text-[12px]"
          placeholder="-----BEGIN CERTIFICATE-----"
        />
      </FormField>
      <FormField label="Clave privada (PEM)" error={errors.key}>
        <Textarea
          value={key}
          onChange={e => setKey(e.target.value)}
          error={!!errors.key}
          rows={6}
          className="font-mono text-[12px]"
          placeholder="-----BEGIN PRIVATE KEY-----"
        />
      </FormField>
      <FormField label="Etiqueta (opcional)">
        <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Certificado producción 2026" />
      </FormField>

      {serverError && <p className="text-[13px] text-danger">{serverError}</p>}

      <div>
        <Button size="sm" disabled={saving} onClick={handleUpload}>
          {saving ? 'Guardando…' : 'Guardar certificado'}
        </Button>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={open => { if (!open) setToDelete(null) }}
        title="Quitar certificado"
        description={toDelete ? `Se eliminará el certificado de ${ENVIRONMENT_LABEL[toDelete]}. No podrás emitir en ese entorno hasta cargar uno nuevo.` : ''}
        confirmLabel="Quitar"
        variant="danger"
        onConfirm={handleDelete}
      />
    </section>
  )
}

// ── Section 3: Cola de contingencia ──────────────────────────────────────────

type Emission = {
  id: string
  document_type: 'invoice' | 'credit_note' | 'debit_note'
  document_id: string
  status: 'pending' | 'authorized' | 'rejected' | 'error'
  retries: number
  error: string | null
  last_attempt_at: string | null
}

const EMISSION_STATUS: Record<Emission['status'], { label: string; status: 'pending' | 'success' | 'error' | 'neutral' }> = {
  pending: { label: 'Pendiente', status: 'pending' },
  authorized: { label: 'Autorizado', status: 'success' },
  rejected: { label: 'Rechazado', status: 'error' },
  error: { label: 'Error', status: 'error' },
}

const DOC_TYPE_LABEL: Record<Emission['document_type'], string> = {
  invoice: 'Factura',
  credit_note: 'Nota de crédito',
  debit_note: 'Nota de débito',
}

function ContingencySection() {
  const [rows, setRows] = useState<Emission[]>([])
  const [refresh, setRefresh] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchJson<{ data: Emission[] }>('/api/v1/afip/contingency?limit=50')
      .then(data => { if (!cancelled) setRows(data.data ?? []) })
      .catch(e => { if (!cancelled) notifyApiError(e) })
    return () => { cancelled = true }
  }, [refresh])

  async function retry(id: string) {
    setBusy(true)
    try {
      await fetchJson(`/api/v1/afip/contingency/${id}/retry`, { method: 'POST' })
      notifySuccess('Reintento enviado')
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    } finally {
      setBusy(false)
    }
  }

  async function syncAll() {
    setBusy(true)
    try {
      const res = await fetchJson<{ processed: number }>('/api/v1/afip/contingency', { method: 'POST' })
      notifySuccess(`Sincronización completada (${res.processed} comprobante${res.processed !== 1 ? 's' : ''})`)
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    } finally {
      setBusy(false)
    }
  }

  const columns: Column<Emission>[] = [
    { key: 'document_type', header: 'Comprobante', render: r => DOC_TYPE_LABEL[r.document_type] },
    { key: 'status', header: 'Estado', render: r => <Badge status={EMISSION_STATUS[r.status].status}>{EMISSION_STATUS[r.status].label}</Badge> },
    { key: 'retries', header: 'Intentos', align: 'right', render: r => <span className="tabular-nums">{r.retries}</span> },
    { key: 'error', header: 'Detalle', render: r => <span className="text-[12px] text-fg-muted truncate max-w-[260px] block">{r.error ?? '—'}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: r => <Button size="xs" variant="ghost" disabled={busy} onClick={() => retry(r.id)}>Reintentar</Button>,
    },
  ]

  return (
    <section className="rounded-sm border border-border bg-surface p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-fg">Cola de contingencia</h2>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            Comprobantes que no pudieron enviarse a AFIP. Reintentá individualmente o sincronizá todos.
          </p>
        </div>
        <Button size="sm" variant="secondary" disabled={busy} onClick={syncAll}>Sincronizar todo</Button>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        keyExtractor={r => r.id}
        emptyMessage="No hay comprobantes en cola."
      />
    </section>
  )
}

export function AfipConfigTab() {
  return (
    <div className="space-y-5">
      <DatosFiscalesSection />
      <PieTicketPosSection />
      <PuntosDeVentaSection />
      <CertificadoSection />
      <ContingencySection />
    </div>
  )
}
