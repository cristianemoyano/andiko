'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody, FormSection } from '@/components/layout'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { Textarea } from '@/components/primitives/Textarea'
import { Select } from '@/components/primitives/Select'
import { Switch } from '@/components/primitives/Switch'
import { Checkbox } from '@/components/primitives/Checkbox'
import { CurrencyInput } from '@/components/primitives/CurrencyInput'
import { DateInput } from '@/components/primitives/DateInput'
import { Button } from '@/components/primitives/Button'
import { SearchableSelect } from '@/components/erp'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'
import { notifyError, notifySuccess } from '@/lib/notify'
import {
  CAMPAIGN_CHANNELS, CAMPAIGN_WALLETS, CAMPAIGN_CARD_BRANDS, CAMPAIGN_CARD_TYPES,
  type CampaignRewardKind, type CampaignChannel,
} from '@/modules/campaigns/campaign.constants'
import { PAYMENT_METHODS } from '@/modules/sales/payment.constants'
import { PAYMENT_CONDITIONS } from '@/types'

interface PaymentRuleForm {
  payment_method: string
  payment_condition: string
  wallet: string
  card_brand: string
  card_type: string
  via_qr: boolean
}

interface TargetForm {
  target_kind: 'category' | 'product' | 'brand'
  /** id (categoría/producto) o texto de marca (vendor). */
  ref_id: string
  ref_label: string
  is_exclusion: boolean
}

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const CHANNEL_LABEL: Record<CampaignChannel, string> = { pos: 'POS', online: 'Online', manual: 'Manual / ERP' }
const PAYMENT_METHOD_LABEL: Record<string, string> = { cash: 'Efectivo', transfer: 'Transferencia', check: 'Cheque', card: 'Tarjeta', other: 'Otro' }
const PAYMENT_CONDITION_LABEL: Record<string, string> = { cash: 'Contado', net_30: '30 días', net_60: '60 días', net_90: '90 días' }

function emptyPaymentRule(): PaymentRuleForm {
  return { payment_method: '', payment_condition: '', wallet: '', card_brand: '', card_type: '', via_qr: false }
}

function optionsFrom(values: readonly string[], labels?: Record<string, string>) {
  return values.map((v) => ({ value: v, label: labels?.[v] ?? v }))
}

interface PreviewResult {
  effects: { campaign_name: string; value: string; reason: string }[]
  benefits: { reason: string }[]
  warnings: string[]
  totalsBefore: { total: string }
  totalsAfter: { total: string }
}

interface CampaignAnalysisResult {
  applicable: boolean
  discount_pct: string | null
  scope: 'targeted' | 'all_products'
  truncated: boolean
  rows: { variant_id: string; sku: string; name: string; list_price: string; cost_price: string; discounted_price: string; margin_pct: string; is_loss: boolean }[]
  summary: { products: number; losing: number; min_margin_pct: string; safe_discount_ceiling_pct: string; has_losses: boolean }
  projection: { window_days: number; units: string; revenue: string; current_margin: string; estimated_discount: string; projected_margin: string; projected_is_loss: boolean } | null
}

function formatMoney(v: string): string {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : v
}

export function CampanaFormClient({ campaignId }: { campaignId?: string }) {
  const router = useRouter()
  const isEdit = !!campaignId

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [terms, setTerms] = useState('')
  const [rewardKind, setRewardKind] = useState<CampaignRewardKind>('percent')
  const [rewardPercent, setRewardPercent] = useState('')
  const [installmentsCount, setInstallmentsCount] = useState('3')
  const [interestFree, setInterestFree] = useState(true)
  const [validFrom, setValidFrom] = useState<Date | null>(new Date())
  const [validTo, setValidTo] = useState<Date | null>(null)
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [channels, setChannels] = useState<CampaignChannel[]>([])
  const [minPurchase, setMinPurchase] = useState('')
  const [requiresCoupon, setRequiresCoupon] = useState(false)
  const [stackable, setStackable] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [priority, setPriority] = useState('100')
  const [paymentRules, setPaymentRules] = useState<PaymentRuleForm[]>([])
  const [targets, setTargets] = useState<TargetForm[]>([])

  const [loading, setLoading] = useState(isEdit)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [previewPrice, setPreviewPrice] = useState('10000')
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const [analysis, setAnalysis] = useState<CampaignAnalysisResult | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  function reportError(message: string) {
    setServerError(message)
    notifyError(message)
  }

  useEffect(() => {
    if (!campaignId) return
    let cancelled = false
    ;(async () => {
      try {
        const c = await fetchJson<Record<string, unknown> & {
          targets?: { target_kind: string; category_id: string | null; product_id: string | null; brand: string | null; is_exclusion: boolean }[]
          paymentRules?: PaymentRuleForm[]
        }>(`/api/v1/campaigns/${campaignId}`)
        if (cancelled) return
        setName(String(c.name ?? ''))
        setDescription(String(c.description ?? ''))
        setTerms(String(c.terms ?? ''))
        setRewardKind((c.reward_kind as CampaignRewardKind) ?? 'percent')
        setRewardPercent(c.reward_percent ? String(c.reward_percent) : '')
        setInstallmentsCount(c.installments_count ? String(c.installments_count) : '3')
        setInterestFree(Boolean(c.installments_interest_free))
        setValidFrom(c.valid_from ? new Date(String(c.valid_from)) : new Date())
        setValidTo(c.valid_to ? new Date(String(c.valid_to)) : null)
        setWeekdays(Array.isArray(c.active_weekdays) ? (c.active_weekdays as number[]) : [])
        setChannels(Array.isArray(c.channels) ? (c.channels as CampaignChannel[]) : [])
        setMinPurchase(c.min_purchase_amount ? String(c.min_purchase_amount) : '')
        setRequiresCoupon(Boolean(c.requires_coupon))
        setStackable(Boolean(c.stackable))
        setIsActive(Boolean(c.is_active))
        setPriority(String(c.priority ?? 100))
        setPaymentRules((c.paymentRules ?? []).map((r) => ({
          payment_method: r.payment_method ?? '', payment_condition: r.payment_condition ?? '',
          wallet: r.wallet ?? '', card_brand: r.card_brand ?? '', card_type: r.card_type ?? '', via_qr: Boolean(r.via_qr),
        })))
        setTargets((c.targets ?? []).map((t) => {
          const kind = t.target_kind === 'product' ? 'product' : t.target_kind === 'brand' ? 'brand' : 'category'
          const ref = kind === 'brand' ? (t.brand ?? '') : kind === 'product' ? (t.product_id ?? '') : (t.category_id ?? '')
          return { target_kind: kind as TargetForm['target_kind'], ref_id: ref, ref_label: ref, is_exclusion: t.is_exclusion }
        }))
        setLoading(false)
      } catch (e) {
        if (cancelled) return
        setLoading(false)
        reportError(getApiErrorMessage(e))
      }
    })()
    return () => { cancelled = true }
  }, [campaignId])

  function toggleWeekday(d: number) {
    setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]))
  }
  function toggleChannel(c: CampaignChannel) {
    setChannels((ch) => (ch.includes(c) ? ch.filter((x) => x !== c) : [...ch, c]))
  }

  function buildPayload(): Record<string, unknown> {
    const cleanRules = paymentRules
      .map((r) => ({
        payment_method: r.payment_method || null,
        payment_condition: r.payment_condition || null,
        wallet: r.wallet || null,
        card_brand: r.card_brand || null,
        card_type: r.card_type || null,
        via_qr: r.via_qr || null,
      }))
      .filter((r) => r.payment_method || r.payment_condition || r.wallet || r.card_brand || r.card_type || r.via_qr)

    const cleanTargets = targets
      .filter((t) => t.ref_id.trim())
      .map((t) => ({
        target_kind: t.target_kind,
        category_id: t.target_kind === 'category' ? t.ref_id : null,
        product_id: t.target_kind === 'product' ? t.ref_id : null,
        brand: t.target_kind === 'brand' ? t.ref_id.trim() : null,
        is_exclusion: t.is_exclusion,
      }))

    const from = validFrom ?? new Date()
    const to = validTo ?? new Date(from.getFullYear() + 1, from.getMonth(), from.getDate())

    return {
      name,
      description: description || null,
      terms: terms || null,
      reward_kind: rewardKind,
      reward_percent: rewardKind === 'percent' ? (rewardPercent || '0') : null,
      installments_count: rewardKind === 'installments' ? Number(installmentsCount || '0') : null,
      installments_interest_free: rewardKind === 'installments' ? interestFree : null,
      requires_coupon: requiresCoupon,
      stackable,
      priority: Number(priority || '100'),
      min_purchase_amount: minPurchase || null,
      valid_from: new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0).toISOString(),
      valid_to: new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59).toISOString(),
      active_weekdays: weekdays.length ? [...weekdays].sort() : null,
      channels: channels.length ? channels : null,
      is_active: isActive,
      targets: cleanTargets,
      payment_rules: cleanRules,
    }
  }

  async function handleSubmit() {
    setSaving(true)
    setErrors({}); setServerError(null)
    if (!name.trim()) {
      setSaving(false)
      setErrors({ name: ['Poné un nombre a la campaña.'] })
      notifyError('Poné un nombre a la campaña.')
      return
    }
    try {
      const payload = buildPayload()
      if (campaignId) {
        await fetchJson(`/api/v1/campaigns/${campaignId}`, { method: 'PATCH', body: JSON.stringify(payload) })
      } else {
        await fetchJson('/api/v1/campaigns', { method: 'POST', body: JSON.stringify(payload) })
      }
      notifySuccess(isEdit ? 'Campaña actualizada' : 'Campaña creada')
      router.push('/campanas')
    } catch (e) {
      const fe = fieldErrorsFromApiError(e)
      if (fe) {
        setErrors(fe)
        notifyError('Revisá los campos marcados e intentá de nuevo.')
      } else {
        reportError(getApiErrorMessage(e))
      }
    } finally {
      setSaving(false)
    }
  }

  async function runPreview() {
    setPreviewError(null); setPreview(null)
    try {
      const payload = {
        campaign: buildPayload(),
        lines: [{ line_id: '1', quantity: '1', unit_price: previewPrice || '0', discount_pct: '0', iva_rate: '21' }],
        cart: { channel: channels[0] ?? 'pos', at: new Date().toISOString() },
      }
      const result = await fetchJson<PreviewResult>('/api/v1/campaigns/preview', { method: 'POST', body: JSON.stringify(payload) })
      setPreview(result)
    } catch (e) {
      const msg = getApiErrorMessage(e)
      setPreviewError(msg)
      notifyError(msg, 'No se pudo previsualizar')
    }
  }

  async function runAnalysis() {
    setAnalyzing(true); setAnalysisError(null); setAnalysis(null)
    try {
      const body = campaignId ? { campaign_id: campaignId } : { campaign: buildPayload() }
      const result = await fetchJson<CampaignAnalysisResult>('/api/v1/campaigns/analysis', { method: 'POST', body: JSON.stringify(body) })
      setAnalysis(result)
    } catch (e) {
      const msg = getApiErrorMessage(e)
      setAnalysisError(msg)
      notifyError(msg, 'No se pudo analizar la rentabilidad')
    } finally {
      setAnalyzing(false)
    }
  }

  const searchCategories = useCallback(async (q: string) => {
    const res = await fetchJson<{ data: { id: string; name: string }[] }>(`/api/v1/catalog/categories?search=${encodeURIComponent(q)}&limit=20`)
    return res.data.map((c) => ({ value: c.id, label: c.name }))
  }, [])
  const searchProducts = useCallback(async (q: string) => {
    const res = await fetchJson<{ data: { id: string; name: string }[] }>(`/api/v1/catalog/products?search=${encodeURIComponent(q)}&limit=20`)
    return res.data.map((p) => ({ value: p.id, label: p.name }))
  }, [])

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Campañas', href: '/campanas' }, { label: isEdit ? 'Editar campaña' : 'Nueva campaña' }]}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => router.push('/campanas')} disabled={saving}>Cancelar</Button>
            <Button size="sm" onClick={handleSubmit} disabled={saving || loading} data-testid="save-campaign-btn">
              {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear campaña'}
            </Button>
          </div>
        }
      />

      <PageBody>
        <div className="max-w-4xl mx-auto flex flex-col gap-5">
          <div className="pt-1">
            <h1 className="text-xl font-semibold tracking-tight text-fg">{isEdit ? 'Editar campaña' : 'Nueva campaña'}</h1>
            <p className="mt-0.5 text-[13px] text-fg-muted">
              Definí las condiciones (pago, productos, vigencia, canal) y el beneficio. Usá la vista previa y el análisis de rentabilidad antes de activarla.
            </p>
          </div>

          {serverError && (
            <p role="alert" className="text-[13px] text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">
              {serverError}
            </p>
          )}

          {loading ? (
            <p className="text-[13px] text-fg-muted">Cargando campaña…</p>
          ) : (
            <>
              <FormSection title="Datos generales">
                <FormField label="Nombre" htmlFor="c_name" required error={errors.name?.[0]}>
                  <Input id="c_name" value={name} onChange={(e) => setName(e.target.value)} error={!!errors.name} data-testid="campaign-name-input" />
                </FormField>
                <FormField label="Descripción" htmlFor="c_desc">
                  <Textarea id="c_desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                </FormField>
              </FormSection>

              <FormSection title="Beneficio">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Tipo de beneficio" htmlFor="c_reward">
                    <Select
                      id="c_reward"
                      value={rewardKind}
                      onChange={(v) => setRewardKind(v as CampaignRewardKind)}
                      options={[
                        { value: 'percent', label: 'Porcentaje de descuento' },
                        { value: 'installments', label: 'Cuotas sin interés' },
                      ]}
                    />
                  </FormField>
                  {rewardKind === 'percent' ? (
                    <FormField label="Porcentaje (%)" htmlFor="c_pct" error={errors.reward_percent?.[0]}>
                      <Input id="c_pct" value={rewardPercent} onChange={(e) => setRewardPercent(e.target.value)} inputMode="decimal" placeholder="15" error={!!errors.reward_percent} />
                    </FormField>
                  ) : (
                    <FormField label="Cantidad de cuotas" htmlFor="c_inst">
                      <Input id="c_inst" value={installmentsCount} onChange={(e) => setInstallmentsCount(e.target.value)} inputMode="numeric" placeholder="3" />
                    </FormField>
                  )}
                </div>
                {rewardKind === 'installments' && (
                  <label className="flex items-center gap-2 text-[13px] text-fg">
                    <Switch checked={interestFree} onCheckedChange={setInterestFree} /> Sin interés
                  </label>
                )}
              </FormSection>

              <FormSection title="Vigencia y días">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Desde" htmlFor="c_from" error={errors.valid_from?.[0]}>
                    <DateInput id="c_from" value={validFrom} onChange={setValidFrom} error={!!errors.valid_from} />
                  </FormField>
                  <FormField label="Hasta" htmlFor="c_to" error={errors.valid_to?.[0]}>
                    <DateInput id="c_to" value={validTo} onChange={setValidTo} error={!!errors.valid_to} />
                  </FormField>
                </div>
                <div>
                  <span className="text-[12px] text-fg-muted">Días de la semana (vacío = todos)</span>
                  <div className="mt-1 flex flex-wrap gap-3">
                    {WEEKDAYS.map((label, d) => (
                      <label key={d} className="flex items-center gap-1.5 text-[13px] text-fg">
                        <Checkbox checked={weekdays.includes(d)} onCheckedChange={() => toggleWeekday(d)} /> {label}
                      </label>
                    ))}
                  </div>
                </div>
              </FormSection>

              <FormSection title="Canal y mínimo">
                <div className="flex flex-wrap gap-3">
                  {CAMPAIGN_CHANNELS.map((c) => (
                    <label key={c} className="flex items-center gap-1.5 text-[13px] text-fg">
                      <Checkbox checked={channels.includes(c)} onCheckedChange={() => toggleChannel(c)} /> {CHANNEL_LABEL[c]}
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-fg-subtle">Vacío = todos los canales. Para “no válido online”, marcá solo POS y Manual.</p>
                <div className="max-w-[220px]">
                  <FormField label="Compra mínima (ARS)" htmlFor="c_min">
                    <CurrencyInput id="c_min" value={minPurchase} onChange={setMinPurchase} />
                  </FormField>
                </div>
              </FormSection>

              <FormSection title="Condiciones de pago (vacío = cualquiera)">
                <div className="flex flex-col gap-3">
                  {paymentRules.map((rule, idx) => (
                    <div key={idx} className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-sm border border-border-subtle p-2">
                      <Select value={rule.payment_method} placeholder="Medio" onChange={(v) => setPaymentRules((rs) => rs.map((r, i) => i === idx ? { ...r, payment_method: v } : r))} options={[{ value: '', label: 'Cualquier medio' }, ...optionsFrom(PAYMENT_METHODS, PAYMENT_METHOD_LABEL)]} />
                      <Select value={rule.wallet} placeholder="Wallet" onChange={(v) => setPaymentRules((rs) => rs.map((r, i) => i === idx ? { ...r, wallet: v } : r))} options={[{ value: '', label: 'Cualquier wallet' }, ...optionsFrom(CAMPAIGN_WALLETS)]} />
                      <Select value={rule.card_brand} placeholder="Tarjeta" onChange={(v) => setPaymentRules((rs) => rs.map((r, i) => i === idx ? { ...r, card_brand: v } : r))} options={[{ value: '', label: 'Cualquier marca' }, ...optionsFrom(CAMPAIGN_CARD_BRANDS)]} />
                      <Select value={rule.card_type} placeholder="Crédito/Débito" onChange={(v) => setPaymentRules((rs) => rs.map((r, i) => i === idx ? { ...r, card_type: v } : r))} options={[{ value: '', label: 'Crédito o débito' }, ...optionsFrom(CAMPAIGN_CARD_TYPES, { credit: 'Crédito', debit: 'Débito' })]} />
                      <Select value={rule.payment_condition} placeholder="Condición" onChange={(v) => setPaymentRules((rs) => rs.map((r, i) => i === idx ? { ...r, payment_condition: v } : r))} options={[{ value: '', label: 'Cualquier condición' }, ...optionsFrom(PAYMENT_CONDITIONS, PAYMENT_CONDITION_LABEL)]} />
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-1.5 text-[13px] text-fg"><Checkbox checked={rule.via_qr} onCheckedChange={(v) => setPaymentRules((rs) => rs.map((r, i) => i === idx ? { ...r, via_qr: v === true } : r))} /> QR</label>
                        <Button variant="ghost" size="xs" onClick={() => setPaymentRules((rs) => rs.filter((_, i) => i !== idx))}>Quitar</Button>
                      </div>
                    </div>
                  ))}
                  <div>
                    <Button variant="secondary" size="sm" onClick={() => setPaymentRules((rs) => [...rs, emptyPaymentRule()])}>+ Condición de pago</Button>
                  </div>
                </div>
              </FormSection>

              <FormSection title="Productos (vacío = todos)">
                <div className="flex flex-col gap-3">
                  {targets.map((t, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-[130px_1fr_auto] gap-2 items-center rounded-sm border border-border-subtle p-2">
                      <Select
                        value={t.target_kind}
                        onChange={(v) => setTargets((ts) => ts.map((x, i) => i === idx ? { ...x, target_kind: v as TargetForm['target_kind'], ref_id: '', ref_label: '' } : x))}
                        options={[{ value: 'category', label: 'Categoría' }, { value: 'product', label: 'Producto' }, { value: 'brand', label: 'Marca' }]}
                      />
                      {t.target_kind === 'brand' ? (
                        <Input
                          value={t.ref_id}
                          onChange={(e) => setTargets((ts) => ts.map((x, i) => i === idx ? { ...x, ref_id: e.target.value } : x))}
                          placeholder="Marca (ej. Chandon)"
                        />
                      ) : (
                        <SearchableSelect
                          value={t.ref_id || null}
                          onChange={(v) => setTargets((ts) => ts.map((x, i) => i === idx ? { ...x, ref_id: v ?? '' } : x))}
                          onSearch={t.target_kind === 'category' ? searchCategories : searchProducts}
                          options={t.ref_id ? [{ value: t.ref_id, label: t.ref_label || t.ref_id }] : []}
                          placeholder={t.target_kind === 'category' ? 'Buscar categoría…' : 'Buscar producto…'}
                        />
                      )}
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-[13px] text-fg"><Checkbox checked={t.is_exclusion} onCheckedChange={(v) => setTargets((ts) => ts.map((x, i) => i === idx ? { ...x, is_exclusion: v === true } : x))} /> Excluir</label>
                        <Button variant="ghost" size="xs" onClick={() => setTargets((ts) => ts.filter((_, i) => i !== idx))}>Quitar</Button>
                      </div>
                    </div>
                  ))}
                  <div>
                    <Button variant="secondary" size="sm" onClick={() => setTargets((ts) => [...ts, { target_kind: 'category', ref_id: '', ref_label: '', is_exclusion: false }])}>+ Condición de producto</Button>
                  </div>
                </div>
              </FormSection>

              <FormSection title="Opciones">
                <label className="flex items-center justify-between text-[13px] text-fg"><span>Requiere cupón</span><Switch checked={requiresCoupon} onCheckedChange={setRequiresCoupon} /></label>
                <label className="flex items-center justify-between text-[13px] text-fg"><span>Acumulable con otras campañas</span><Switch checked={stackable} onCheckedChange={setStackable} /></label>
                <label className="flex items-center justify-between text-[13px] text-fg"><span>Activa</span><Switch checked={isActive} onCheckedChange={setIsActive} /></label>
                <div className="max-w-[160px]">
                  <FormField label="Prioridad (menor primero)" htmlFor="c_prio">
                    <Input id="c_prio" value={priority} onChange={(e) => setPriority(e.target.value)} inputMode="numeric" />
                  </FormField>
                </div>
                <FormField label="Términos y condiciones" htmlFor="c_terms">
                  <Textarea id="c_terms" value={terms} onChange={(e) => setTerms(e.target.value)} rows={2} placeholder="Aplican exclusiones. No válido para venta online…" />
                </FormField>
              </FormSection>

              <FormSection title="Vista previa">
                <div className="flex items-end gap-2">
                  <div className="max-w-[180px]">
                    <FormField label="Precio de ejemplo (ARS)" htmlFor="c_prev">
                      <CurrencyInput id="c_prev" value={previewPrice} onChange={setPreviewPrice} />
                    </FormField>
                  </div>
                  <Button variant="secondary" size="sm" onClick={runPreview} data-testid="preview-btn">Probar</Button>
                </div>
                {previewError && <p className="text-[12px] text-danger">{previewError}</p>}
                {preview && (
                  <div className="text-[12px] text-fg" data-testid="preview-result">
                    {preview.effects.length === 0 && preview.benefits.length === 0 ? (
                      <p className="text-fg-muted">La campaña no aplica al carrito de ejemplo.</p>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {preview.effects.map((e, i) => <li key={`e${i}`}>• {e.reason}</li>)}
                        {preview.benefits.map((b, i) => <li key={`b${i}`}>• {b.reason}</li>)}
                        <li className="text-fg-muted">Total: {preview.totalsBefore.total} → {preview.totalsAfter.total}</li>
                        {preview.warnings.map((w, i) => <li key={`w${i}`} className="text-warning">⚠ {w}</li>)}
                      </ul>
                    )}
                  </div>
                )}
              </FormSection>

              <FormSection title="Rentabilidad y proyección">
                <p className="text-[11px] text-fg-subtle">
                  El límite de un descuento es el <strong>costo variable</strong> del producto: el precio con descuento debe
                  quedar por encima del costo. Debajo de ese límite, cada venta pierde plata.
                </p>
                <div>
                  <Button variant="secondary" size="sm" onClick={runAnalysis} disabled={analyzing} data-testid="analyze-btn">
                    {analyzing ? 'Analizando…' : 'Analizar rentabilidad'}
                  </Button>
                </div>
                {analysisError && <p className="text-[12px] text-danger">{analysisError}</p>}
                {analysis && !analysis.applicable && (
                  <p className="text-[12px] text-fg-muted">Las campañas de cuotas no descuentan el precio: no afectan el margen.</p>
                )}
                {analysis && analysis.applicable && (
                  <div className="flex flex-col gap-2 text-[12px]" data-testid="analysis-result">
                    <div className={`rounded-sm border px-2 py-1.5 ${analysis.summary.has_losses ? 'border-danger bg-danger-bg text-danger' : 'border-border bg-surface-muted text-fg'}`}>
                      {analysis.summary.has_losses
                        ? `⚠ ${analysis.summary.losing} de ${analysis.summary.products} producto(s) quedan en pérdida con ${analysis.discount_pct}% de descuento.`
                        : `✓ Ningún producto queda en pérdida con ${analysis.discount_pct}% (${analysis.summary.products} analizado(s)).`}
                      {' '}Descuento máximo seguro para todos: <strong>{analysis.summary.safe_discount_ceiling_pct}%</strong>.
                      {analysis.scope === 'all_products' && ' (sin condiciones de producto: muestra acotada)'}
                    </div>

                    {analysis.rows.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <thead className="text-fg-muted">
                            <tr className="text-left">
                              <th className="py-1 pr-2">Producto</th>
                              <th className="py-1 pr-2 text-right">Lista</th>
                              <th className="py-1 pr-2 text-right">C/desc.</th>
                              <th className="py-1 pr-2 text-right">Costo</th>
                              <th className="py-1 pr-2 text-right">Margen</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analysis.rows.slice(0, 8).map((r) => (
                              <tr key={r.variant_id} className={r.is_loss ? 'text-danger' : 'text-fg'}>
                                <td className="py-0.5 pr-2">{r.name}{r.is_loss ? ' ⚠' : ''}</td>
                                <td className="py-0.5 pr-2 text-right">{formatMoney(r.list_price)}</td>
                                <td className="py-0.5 pr-2 text-right">{formatMoney(r.discounted_price)}</td>
                                <td className="py-0.5 pr-2 text-right">{formatMoney(r.cost_price)}</td>
                                <td className="py-0.5 pr-2 text-right">{r.margin_pct}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {analysis.rows.length > 8 && <p className="mt-1 text-fg-subtle">… y {analysis.rows.length - 8} más</p>}
                      </div>
                    )}

                    {analysis.projection && (
                      <div className="rounded-sm border border-border bg-surface-muted px-2 py-1.5 text-fg">
                        <span className="text-fg-muted">Proyección últimos {analysis.projection.window_days} días — </span>
                        {formatMoney(analysis.projection.units)} u. vendidas, facturación ${formatMoney(analysis.projection.revenue)}.
                        Descuento estimado: <strong>${formatMoney(analysis.projection.estimated_discount)}</strong>.
                        Margen: ${formatMoney(analysis.projection.current_margin)} → <strong className={analysis.projection.projected_is_loss ? 'text-danger' : ''}>${formatMoney(analysis.projection.projected_margin)}</strong>
                        {analysis.projection.projected_is_loss ? ' ⚠ negativo' : ''}.
                      </div>
                    )}
                  </div>
                )}
              </FormSection>
            </>
          )}
        </div>
      </PageBody>
    </div>
  )
}
