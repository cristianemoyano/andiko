'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogFooter } from '@/components/primitives/Dialog'
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
import {
  CAMPAIGN_CHANNELS, CAMPAIGN_WALLETS, CAMPAIGN_CARD_BRANDS, CAMPAIGN_CARD_TYPES,
  type CampaignRewardKind, type CampaignChannel,
} from '@/modules/campaigns/campaign.constants'
import { PAYMENT_METHODS } from '@/modules/sales/payment.constants'
import { PAYMENT_CONDITIONS } from '@/types'

export interface CampaignRow {
  id: string
  name: string
  reward_kind: CampaignRewardKind
  reward_percent: string | null
  installments_count: number | null
  installments_interest_free: boolean | null
  requires_coupon: boolean
  stackable: boolean
  priority: number
  valid_from: string
  valid_to: string
  is_active: boolean
}

interface PaymentRuleForm {
  payment_method: string
  payment_condition: string
  wallet: string
  card_brand: string
  card_type: string
  via_qr: boolean
}

interface TargetForm {
  target_kind: 'category' | 'product'
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

export function CampaignModal({
  open, campaignId, onClose, onSaved,
}: {
  open: boolean
  campaignId: string | null
  onClose: () => void
  onSaved: () => void
}) {
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

  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [previewPrice, setPreviewPrice] = useState('10000')
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const resetForm = useCallback(() => {
    setName(''); setDescription(''); setTerms('')
    setRewardKind('percent'); setRewardPercent(''); setInstallmentsCount('3'); setInterestFree(true)
    setValidFrom(new Date()); setValidTo(null); setWeekdays([]); setChannels([]); setMinPurchase('')
    setRequiresCoupon(false); setStackable(false); setIsActive(true); setPriority('100')
    setPaymentRules([]); setTargets([]); setErrors({}); setServerError(null); setPreview(null); setPreviewError(null)
  }, [])

  useEffect(() => {
    if (!open) return
    ;(async () => {
      if (!campaignId) { resetForm(); return }
      try {
        const c = await fetchJson<Record<string, unknown> & {
          targets?: { target_kind: string; category_id: string | null; product_id: string | null; is_exclusion: boolean }[]
          paymentRules?: PaymentRuleForm[]
        }>(`/api/v1/campaigns/${campaignId}`)
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
        setTargets((c.targets ?? []).map((t) => ({
          target_kind: (t.target_kind === 'product' ? 'product' : 'category'),
          ref_id: (t.category_id ?? t.product_id ?? ''),
          ref_label: (t.category_id ?? t.product_id ?? ''),
          is_exclusion: t.is_exclusion,
        })))
        setErrors({}); setServerError(null); setPreview(null)
      } catch (e) {
        setServerError(getApiErrorMessage(e))
      }
    })()
  }, [open, campaignId, resetForm])

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
      .filter((t) => t.ref_id)
      .map((t) => ({
        target_kind: t.target_kind,
        category_id: t.target_kind === 'category' ? t.ref_id : null,
        product_id: t.target_kind === 'product' ? t.ref_id : null,
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
    try {
      const payload = buildPayload()
      if (campaignId) {
        await fetchJson(`/api/v1/campaigns/${campaignId}`, { method: 'PATCH', body: JSON.stringify(payload) })
      } else {
        await fetchJson('/api/v1/campaigns', { method: 'POST', body: JSON.stringify(payload) })
      }
      onSaved()
    } catch (e) {
      const fe = fieldErrorsFromApiError(e)
      if (fe) setErrors(fe)
      else setServerError(getApiErrorMessage(e))
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
        cart: {
          channel: channels[0] ?? 'pos',
          at: new Date().toISOString(),
        },
      }
      const result = await fetchJson<PreviewResult>('/api/v1/campaigns/preview', { method: 'POST', body: JSON.stringify(payload) })
      setPreview(result)
    } catch (e) {
      setPreviewError(getApiErrorMessage(e))
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
    <Dialog
      open={open}
      onOpenChange={(v) => { if (!v) onClose() }}
      title={campaignId ? 'Editar campaña' : 'Nueva campaña'}
      size="lg"
      contentTestId="campaign-modal"
      footer={
        <DialogFooter error={serverError}>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving} data-testid="save-campaign-btn">Guardar</Button>
        </DialogFooter>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label="Nombre" htmlFor="c_name" required error={errors.name?.[0]}>
          <Input id="c_name" value={name} onChange={(e) => setName(e.target.value)} error={!!errors.name} data-testid="campaign-name-input" />
        </FormField>

        <FormField label="Descripción" htmlFor="c_desc">
          <Textarea id="c_desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </FormField>

        {/* Premio */}
        <fieldset className="rounded-md border border-border p-3">
          <legend className="px-1 text-[12px] font-medium text-fg-muted">Beneficio</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <label className="mt-2 flex items-center gap-2 text-[13px] text-fg">
              <Switch checked={interestFree} onCheckedChange={setInterestFree} /> Sin interés
            </label>
          )}
        </fieldset>

        {/* Vigencia y días */}
        <fieldset className="rounded-md border border-border p-3">
          <legend className="px-1 text-[12px] font-medium text-fg-muted">Vigencia</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Desde" htmlFor="c_from" error={errors.valid_from?.[0]}>
              <DateInput id="c_from" value={validFrom} onChange={setValidFrom} error={!!errors.valid_from} />
            </FormField>
            <FormField label="Hasta" htmlFor="c_to" error={errors.valid_to?.[0]}>
              <DateInput id="c_to" value={validTo} onChange={setValidTo} error={!!errors.valid_to} />
            </FormField>
          </div>
          <div className="mt-2">
            <span className="text-[12px] text-fg-muted">Días de la semana (vacío = todos)</span>
            <div className="mt-1 flex flex-wrap gap-3">
              {WEEKDAYS.map((label, d) => (
                <label key={d} className="flex items-center gap-1.5 text-[13px] text-fg">
                  <Checkbox checked={weekdays.includes(d)} onCheckedChange={() => toggleWeekday(d)} /> {label}
                </label>
              ))}
            </div>
          </div>
        </fieldset>

        {/* Canal y mínimo */}
        <fieldset className="rounded-md border border-border p-3">
          <legend className="px-1 text-[12px] font-medium text-fg-muted">Canal y mínimo</legend>
          <div className="flex flex-wrap gap-3">
            {CAMPAIGN_CHANNELS.map((c) => (
              <label key={c} className="flex items-center gap-1.5 text-[13px] text-fg">
                <Checkbox checked={channels.includes(c)} onCheckedChange={() => toggleChannel(c)} /> {CHANNEL_LABEL[c]}
              </label>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-fg-subtle">Vacío = todos los canales. Para “no válido online”, marcá solo POS y Manual.</p>
          <div className="mt-2 max-w-[220px]">
            <FormField label="Compra mínima (ARS)" htmlFor="c_min">
              <CurrencyInput id="c_min" value={minPurchase} onChange={setMinPurchase} />
            </FormField>
          </div>
        </fieldset>

        {/* Condiciones de pago */}
        <fieldset className="rounded-md border border-border p-3">
          <legend className="px-1 text-[12px] font-medium text-fg-muted">Condiciones de pago (vacío = cualquiera)</legend>
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
        </fieldset>

        {/* Productos */}
        <fieldset className="rounded-md border border-border p-3">
          <legend className="px-1 text-[12px] font-medium text-fg-muted">Productos (vacío = todos)</legend>
          <div className="flex flex-col gap-3">
            {targets.map((t, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-[130px_1fr_auto] gap-2 items-center rounded-sm border border-border-subtle p-2">
                <Select
                  value={t.target_kind}
                  onChange={(v) => setTargets((ts) => ts.map((x, i) => i === idx ? { ...x, target_kind: v as 'category' | 'product', ref_id: '', ref_label: '' } : x))}
                  options={[{ value: 'category', label: 'Categoría' }, { value: 'product', label: 'Producto' }]}
                />
                <SearchableSelect
                  value={t.ref_id || null}
                  onChange={(v) => setTargets((ts) => ts.map((x, i) => i === idx ? { ...x, ref_id: v ?? '' } : x))}
                  onSearch={t.target_kind === 'category' ? searchCategories : searchProducts}
                  options={t.ref_id ? [{ value: t.ref_id, label: t.ref_label || t.ref_id }] : []}
                  placeholder={t.target_kind === 'category' ? 'Buscar categoría…' : 'Buscar producto…'}
                />
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
        </fieldset>

        {/* Opciones */}
        <fieldset className="rounded-md border border-border p-3">
          <legend className="px-1 text-[12px] font-medium text-fg-muted">Opciones</legend>
          <div className="flex flex-col gap-2">
            <label className="flex items-center justify-between text-[13px] text-fg"><span>Requiere cupón</span><Switch checked={requiresCoupon} onCheckedChange={setRequiresCoupon} /></label>
            <label className="flex items-center justify-between text-[13px] text-fg"><span>Acumulable con otras campañas</span><Switch checked={stackable} onCheckedChange={setStackable} /></label>
            <label className="flex items-center justify-between text-[13px] text-fg"><span>Activa</span><Switch checked={isActive} onCheckedChange={setIsActive} /></label>
            <div className="max-w-[160px]">
              <FormField label="Prioridad (menor primero)" htmlFor="c_prio">
                <Input id="c_prio" value={priority} onChange={(e) => setPriority(e.target.value)} inputMode="numeric" />
              </FormField>
            </div>
          </div>
        </fieldset>

        <FormField label="Términos y condiciones" htmlFor="c_terms">
          <Textarea id="c_terms" value={terms} onChange={(e) => setTerms(e.target.value)} rows={2} placeholder="Aplican exclusiones. No válido para venta online…" />
        </FormField>

        {/* Vista previa */}
        <fieldset className="rounded-md border border-dashed border-border p-3">
          <legend className="px-1 text-[12px] font-medium text-fg-muted">Vista previa</legend>
          <div className="flex items-end gap-2">
            <div className="max-w-[180px]">
              <FormField label="Precio de ejemplo (ARS)" htmlFor="c_prev">
                <CurrencyInput id="c_prev" value={previewPrice} onChange={setPreviewPrice} />
              </FormField>
            </div>
            <Button variant="secondary" size="sm" onClick={runPreview} data-testid="preview-btn">Probar</Button>
          </div>
          {previewError && <p className="mt-2 text-[12px] text-danger">{previewError}</p>}
          {preview && (
            <div className="mt-2 text-[12px] text-fg" data-testid="preview-result">
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
        </fieldset>
      </div>
    </Dialog>
  )
}
