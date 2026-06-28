'use client'

import { useState } from 'react'
import { Dialog } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { PasswordInput } from '@/components/primitives/PasswordInput'
import { FormField } from '@/components/primitives/FormField'
import { Select } from '@/components/primitives/Select'
import { Switch } from '@/components/primitives/Switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/layout/Tabs'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'
import {
  WooProductsSyncPanel,
  WooOrdersSyncPanel,
  WooCustomersSyncPanel,
} from './SiteModalSyncPanels'
import type { WooSiteRow, OptionRow } from './types'

export type SiteModalTab = 'conexion' | 'catalogo' | 'productos' | 'pedidos' | 'clientes'

interface SiteModalProps {
  open: boolean
  site: WooSiteRow | null
  branches: OptionRow[]
  priceLists: OptionRow[]
  initialTab?: SiteModalTab
  onClose: () => void
  onSaved: () => void
}

type FieldErrors = Record<string, string[]>

function SiteForm({
  site,
  branches,
  priceLists,
  initialTab = 'conexion',
  onClose,
  onSaved,
}: Omit<SiteModalProps, 'open'>) {
  const [persistedSite, setPersistedSite] = useState<WooSiteRow | null>(null)
  const activeSite = site ?? persistedSite
  const siteId = activeSite?.id ?? null
  const isUpdate = siteId !== null
  const [tab, setTab] = useState<SiteModalTab>(initialTab)
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
    if (consumerKey.trim()) body.consumer_key = consumerKey.trim()
    if (consumerSecret.trim()) body.consumer_secret = consumerSecret.trim()

    try {
      if (isUpdate) {
        await fetchJson(
          `/api/v1/integrations/woocommerce/sites/${siteId}`,
          { method: 'PATCH', body: JSON.stringify(body) },
        )
        onSaved()
        if (site) onClose()
      } else {
        const created = await fetchJson<WooSiteRow>('/api/v1/integrations/woocommerce/sites', {
          method: 'POST',
          body: JSON.stringify(body),
        })
        setPersistedSite(created)
        onSaved()
        setTab('productos')
      }
    } catch (err) {
      const fe = fieldErrorsFromApiError(err)
      if (fe) setErrors(fe)
      else setServerError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Tabs value={tab} onValueChange={v => setTab(v as SiteModalTab)}>
        <TabsList aria-label="Configuración del sitio WooCommerce" className="flex-wrap">
          <TabsTrigger value="conexion">Conexión</TabsTrigger>
          <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
          <TabsTrigger value="productos">Productos</TabsTrigger>
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
        </TabsList>

        <TabsContent value="conexion">
          <div className="flex flex-col gap-4">
            <FormField label="Nombre" htmlFor="woo_name" error={errors.name?.[0]}>
              <Input id="woo_name" value={name} onChange={e => setName(e.target.value)} required error={!!errors.name} />
            </FormField>

            <FormField label="Sucursal" htmlFor="woo_branch" error={errors.branch_id?.[0]}>
              <Select
                id="woo_branch"
                value={branchId}
                onChange={setBranchId}
                options={branches.map(b => ({ value: b.id, label: b.name }))}
                placeholder="Seleccionar sucursal…"
                error={!!errors.branch_id}
                required
              />
              <p className="text-[11px] text-fg-muted leading-snug">
                El stock publicado en WooCommerce sale del depósito de esta sucursal.
              </p>
            </FormField>

            <FormField label="URL de la tienda" htmlFor="woo_url" error={errors.store_url?.[0]}>
              <Input id="woo_url" value={storeUrl} onChange={e => setStoreUrl(e.target.value)} placeholder="https://mitienda.com" required error={!!errors.store_url} />
            </FormField>

            <FormField label={isUpdate ? 'Consumer Key (dejar vacío para no cambiar)' : 'Consumer Key'} htmlFor="woo_key" error={errors.consumer_key?.[0]}>
              <Input id="woo_key" value={consumerKey} onChange={e => setConsumerKey(e.target.value)} required={!isUpdate} error={!!errors.consumer_key} />
            </FormField>

            <FormField label={isUpdate ? 'Consumer Secret (dejar vacío para no cambiar)' : 'Consumer Secret'} htmlFor="woo_secret" error={errors.consumer_secret?.[0]}>
              <PasswordInput id="woo_secret" value={consumerSecret} onChange={e => setConsumerSecret(e.target.value)} required={!isUpdate} error={!!errors.consumer_secret} />
            </FormField>

            <Switch checked={isActive} onCheckedChange={setIsActive} label="Sitio activo" />
            <p className="text-[11px] text-fg-muted leading-snug -mt-2">
              Con la integración activa, Andiko recibe pedidos, empuja stock y publica productos para este sitio.
              Si lo desactivás, pausás la sync sin borrar credenciales ni datos ya importados (podés reactivarlo cuando quieras).
            </p>
          </div>
        </TabsContent>

        <TabsContent value="catalogo">
          <div className="flex flex-col gap-4">
            <div className="rounded-sm border border-teal-200/80 bg-teal-50/50 px-3 py-2.5 text-[12px] text-fg-muted leading-snug">
              <span className="font-medium text-teal-900">Stock continuo (automático): </span>
              cada movimiento de inventario en el ERP empuja el disponible a WooCommerce (depósito de la sucursal − margen de seguridad).
              Se configura acá el margen; la sync corre sola, sin ir a la pestaña Productos.
            </div>

            <FormField label="Lista de precios a publicar (opcional)" htmlFor="woo_pricelist" error={errors.price_list_id?.[0]}>
              <Select
                id="woo_pricelist"
                value={priceListId}
                onChange={setPriceListId}
                options={[{ value: '', label: 'Precio base del producto' }, ...priceLists.map(p => ({ value: p.id, label: p.name }))]}
              />
              <p className="text-[11px] text-fg-muted leading-snug">
                Define qué precio envía Andiko a WooCommerce como <strong>regular_price</strong> al publicar o actualizar productos.
                Si elegís una lista, busca el precio vigente de cada variante en esa lista; si no hay ítem, usa el precio base del producto.
                Si dejás «Precio base», siempre se publica el precio base de la variante en el ERP (útil cuando la tienda online usa los mismos precios que el mostrador).
              </p>
            </FormField>

            <FormField label="Margen de seguridad de stock" htmlFor="woo_buffer" error={errors.stock_safety_buffer?.[0]}>
              <Input id="woo_buffer" value={safetyBuffer} onChange={e => setSafetyBuffer(e.target.value)} inputMode="decimal" placeholder="0" error={!!errors.stock_safety_buffer} />
              <p className="text-[11px] text-fg-muted leading-snug">
                Unidades que Andiko reserva en el ERP y no publica en WooCommerce. El stock online es el disponible en la sucursal menos este margen (mínimo 0).
                {' '}Ej.: 10 en depósito y margen 2 → la tienda muestra 8. Sirve para no vender online todo el stock si también vendés por POS o mostrador.
              </p>
            </FormField>

            <Switch
              checked={autoPublish}
              onCheckedChange={setAutoPublish}
              label="Publicar productos automáticamente"
            />
            <p className="text-[11px] text-fg-muted leading-snug -mt-2">
              Al crear o editar variantes en el catálogo del ERP, encola la publicación a este sitio (automático). Para una tienda ya existente en Woo, usá la pestaña Productos → Importación inicial.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="productos">
          <WooProductsSyncPanel
            site={activeSite}
            onApplied={onSaved}
          />
        </TabsContent>

        <TabsContent value="pedidos">
          <WooOrdersSyncPanel site={activeSite} onApplied={onSaved} />
        </TabsContent>

        <TabsContent value="clientes">
          <WooCustomersSyncPanel site={activeSite} onApplied={onSaved} />
        </TabsContent>
      </Tabs>

      {serverError && (
        <p role="alert" className="text-[12px] text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">
          {serverError}
        </p>
      )}

      {(tab === 'conexion' || tab === 'catalogo') && (
        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? 'Guardando…' : isUpdate ? (site ? 'Guardar' : 'Guardar cambios') : 'Conectar'}
          </Button>
        </div>
      )}

      {(tab === 'productos' || tab === 'pedidos' || tab === 'clientes') && (
        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cerrar</Button>
        </div>
      )}
    </form>
  )
}

export function SiteModal({
  open,
  site,
  branches,
  priceLists,
  initialTab,
  onClose,
  onSaved,
}: SiteModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={v => { if (!v) onClose() }}
      title={site ? 'Editar sitio WooCommerce' : 'Conectar sitio WooCommerce'}
      size="lg"
    >
      {open ? (
        <SiteForm
          key={`${site?.id ?? 'new'}:${initialTab ?? 'conexion'}`}
          site={site}
          branches={branches}
          priceLists={priceLists}
          initialTab={initialTab}
          onClose={onClose}
          onSaved={onSaved}
        />
      ) : null}
    </Dialog>
  )
}
