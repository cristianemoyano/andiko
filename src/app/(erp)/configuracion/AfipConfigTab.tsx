'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Textarea } from '@/components/primitives/Textarea'
import { Select } from '@/components/primitives/Select'
import { FormField } from '@/components/primitives/FormField'
import { Badge } from '@/components/primitives/Badge'
import { DataTable, ConfirmDialog, type Column } from '@/components/erp'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
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

// ── Section 1: Puntos de venta ───────────────────────────────────────────────

type AfipConfig = {
  environment: string
  certificateConfigured: boolean
  organization: { cuit: string | null; iva_condition: string | null; legal_name: string | null }
  branches: { id: string; name: string; branch_code: number; punto_venta: number | null }[]
}

function PuntosDeVentaSection() {
  const [config, setConfig] = useState<AfipConfig | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchJson<AfipConfig>('/api/v1/afip/config')
      .then(data => {
        if (cancelled) return
        setConfig(data)
        setDrafts(Object.fromEntries(data.branches.map(b => [b.id, b.punto_venta != null ? String(b.punto_venta) : ''])))
      })
      .catch(e => { if (!cancelled) notifyApiError(e) })
    return () => { cancelled = true }
  }, [refresh])

  async function save(branchId: string) {
    const raw = drafts[branchId]
    const pv = Number(raw)
    if (!raw || Number.isNaN(pv) || pv <= 0) {
      notifyApiError(new Error('Ingresá un punto de venta válido (mayor a 0).'))
      return
    }
    setSavingId(branchId)
    try {
      await fetchJson('/api/v1/afip/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch_id: branchId, punto_venta: pv }),
      })
      notifySuccess('Punto de venta actualizado')
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section className="rounded-sm border border-border bg-surface p-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-fg">Puntos de venta</h2>
        <p className="mt-0.5 text-[12px] text-fg-muted">
          Asigná el punto de venta AFIP habilitado para cada sucursal. Es obligatorio para emitir comprobantes electrónicos.
        </p>
      </div>

      {config && (
        <div className="space-y-2">
          {config.branches.map(b => (
            <div key={b.id} className="flex flex-wrap items-end gap-3 border-b border-border pb-2 last:border-0">
              <div className="min-w-[180px]">
                <p className="text-[13px] font-medium text-fg">{b.name}</p>
                <p className="text-[11px] text-fg-subtle">Sucursal {String(b.branch_code).padStart(2, '0')}</p>
              </div>
              <FormField label="Punto de venta">
                <Input
                  type="number"
                  min="1"
                  className="w-32"
                  value={drafts[b.id] ?? ''}
                  onChange={e => setDrafts(d => ({ ...d, [b.id]: e.target.value }))}
                  placeholder="Ej: 3"
                />
              </FormField>
              <Button size="sm" variant="secondary" disabled={savingId === b.id} onClick={() => save(b.id)}>
                {savingId === b.id ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          ))}
          {config.branches.length === 0 && <p className="text-[13px] text-fg-subtle">No hay sucursales activas.</p>}
        </div>
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
      <PuntosDeVentaSection />
      <CertificadoSection />
      <ContingencySection />
    </div>
  )
}
