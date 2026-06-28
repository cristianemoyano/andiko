'use client'

import { useState } from 'react'
import { Dialog } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { PasswordInput } from '@/components/primitives/PasswordInput'
import { FormField } from '@/components/primitives/FormField'
import { Select } from '@/components/primitives/Select'
import { Switch } from '@/components/primitives/Switch'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'
import type { WooSiteRow, OptionRow } from './types'

interface SiteModalProps {
  open: boolean
  site: WooSiteRow | null
  branches: OptionRow[]
  priceLists: OptionRow[]
  onClose: () => void
  onSaved: () => void
}

type FieldErrors = Record<string, string[]>

function SiteForm({ site, branches, priceLists, onClose, onSaved }: Omit<SiteModalProps, 'open'>) {
  const isEdit = site !== null
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)

  const [name, setName] = useState(site?.name ?? '')
  const [branchId, setBranchId] = useState(site?.branch_id ?? '')
  const [storeUrl, setStoreUrl] = useState(site?.store_url ?? '')
  const [consumerKey, setConsumerKey] = useState('')
  const [consumerSecret, setConsumerSecret] = useState('')
  const [priceListId, setPriceListId] = useState(site?.price_list_id ?? '')
  const [safetyBuffer, setSafetyBuffer] = useState(site?.stock_safety_buffer ?? '0')
  const [autoPublish, setAutoPublish] = useState(site?.auto_publish ?? false)
  const [isActive, setIsActive] = useState(site?.is_active ?? true)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    setServerError(null)

    const body: Record<string, unknown> = {
      name: name.trim(),
      branch_id: branchId,
      store_url: storeUrl.trim(),
      price_list_id: priceListId || null,
      stock_safety_buffer: safetyBuffer.trim() || '0',
      auto_publish: autoPublish,
      is_active: isActive,
    }
    // Secrets are only sent when provided (kept as-is on edit otherwise).
    if (consumerKey.trim()) body.consumer_key = consumerKey.trim()
    if (consumerSecret.trim()) body.consumer_secret = consumerSecret.trim()

    try {
      await fetchJson(
        isEdit ? `/api/v1/integrations/woocommerce/sites/${site!.id}` : '/api/v1/integrations/woocommerce/sites',
        { method: isEdit ? 'PATCH' : 'POST', body: JSON.stringify(body) },
      )
      onSaved()
      onClose()
    } catch (err) {
      const fe = fieldErrorsFromApiError(err)
      if (fe) setErrors(fe)
      else setServerError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="flex flex-col gap-4">
        <FormField label="Nombre" htmlFor="woo_name" error={errors.name?.[0]}>
          <Input id="woo_name" value={name} onChange={e => setName(e.target.value)} required error={!!errors.name} />
        </FormField>

        <FormField label="Sucursal (comparte el stock de su depósito)" htmlFor="woo_branch" error={errors.branch_id?.[0]}>
          <Select
            id="woo_branch"
            value={branchId}
            onChange={setBranchId}
            options={branches.map(b => ({ value: b.id, label: b.name }))}
            placeholder="Seleccionar sucursal…"
            error={!!errors.branch_id}
            required
          />
        </FormField>

        <FormField label="URL de la tienda" htmlFor="woo_url" error={errors.store_url?.[0]}>
          <Input id="woo_url" value={storeUrl} onChange={e => setStoreUrl(e.target.value)} placeholder="https://mitienda.com" required error={!!errors.store_url} />
        </FormField>

        <FormField label={isEdit ? 'Consumer Key (dejar vacío para no cambiar)' : 'Consumer Key'} htmlFor="woo_key" error={errors.consumer_key?.[0]}>
          <Input id="woo_key" value={consumerKey} onChange={e => setConsumerKey(e.target.value)} required={!isEdit} error={!!errors.consumer_key} />
        </FormField>

        <FormField label={isEdit ? 'Consumer Secret (dejar vacío para no cambiar)' : 'Consumer Secret'} htmlFor="woo_secret" error={errors.consumer_secret?.[0]}>
          <PasswordInput id="woo_secret" value={consumerSecret} onChange={e => setConsumerSecret(e.target.value)} required={!isEdit} error={!!errors.consumer_secret} />
        </FormField>

        <FormField label="Lista de precios a publicar (opcional)" htmlFor="woo_pricelist" error={errors.price_list_id?.[0]}>
          <Select
            id="woo_pricelist"
            value={priceListId}
            onChange={setPriceListId}
            options={[{ value: '', label: 'Precio base del producto' }, ...priceLists.map(p => ({ value: p.id, label: p.name }))]}
          />
        </FormField>

        <FormField label="Margen de seguridad de stock" htmlFor="woo_buffer" error={errors.stock_safety_buffer?.[0]}>
          <Input id="woo_buffer" value={safetyBuffer} onChange={e => setSafetyBuffer(e.target.value)} inputMode="decimal" error={!!errors.stock_safety_buffer} />
        </FormField>

        <Switch checked={autoPublish} onCheckedChange={setAutoPublish} label="Publicar productos automáticamente" />
        <Switch checked={isActive} onCheckedChange={setIsActive} label="Sitio activo" />

        {serverError && (
          <p role="alert" className="text-[12px] text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">
            {serverError}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" size="sm" disabled={saving}>{saving ? 'Guardando…' : isEdit ? 'Guardar' : 'Conectar'}</Button>
        </div>
      </div>
    </form>
  )
}

export function SiteModal({ open, site, branches, priceLists, onClose, onSaved }: SiteModalProps) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }} title={site ? 'Editar sitio WooCommerce' : 'Conectar sitio WooCommerce'} size="md">
      {open ? <SiteForm key={site?.id ?? 'new'} site={site} branches={branches} priceLists={priceLists} onClose={onClose} onSaved={onSaved} /> : null}
    </Dialog>
  )
}
