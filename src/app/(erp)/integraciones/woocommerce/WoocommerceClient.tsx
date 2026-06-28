'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/primitives/Button'
import { Badge } from '@/components/primitives/Badge'
import { ConfirmDialog } from '@/components/erp'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { SiteModal } from './SiteModal'
import { ImportModal } from './ImportModal'
import type { WooSiteRow, OptionRow } from './types'

interface PaginatedResponse<T> { data: T[] }

export function WoocommerceClient() {
  const [sites, setSites] = useState<WooSiteRow[]>([])
  const [branches, setBranches] = useState<OptionRow[]>([])
  const [priceLists, setPriceLists] = useState<OptionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<WooSiteRow | null>(null)
  const [importing, setImporting] = useState<WooSiteRow | null>(null)
  const [deleting, setDeleting] = useState<WooSiteRow | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [sitesRes, branchesRes, priceListsRes] = await Promise.all([
          fetchJson<PaginatedResponse<WooSiteRow>>('/api/v1/integrations/woocommerce/sites?limit=100'),
          fetchJson<PaginatedResponse<OptionRow>>('/api/v1/branches?limit=100'),
          fetchJson<PaginatedResponse<OptionRow>>('/api/v1/catalog/price-lists?limit=100'),
        ])
        if (cancelled) return
        setSites(sitesRes.data)
        setBranches(branchesRes.data)
        setPriceLists(priceListsRes.data)
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [refresh])

  const branchName = (id: string) => branches.find(b => b.id === id)?.name ?? '—'

  async function publishCatalog(site: WooSiteRow) {
    setBusyId(site.id)
    setError(null)
    try {
      await fetchJson(`/api/v1/integrations/woocommerce/sites/${site.id}/publish`, { method: 'POST' })
      setRefresh(r => r + 1)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    await fetchJson(`/api/v1/integrations/woocommerce/sites/${deleting.id}`, { method: 'DELETE' })
    setDeleting(null)
    setRefresh(r => r + 1)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold">WooCommerce</h1>
          <p className="text-[13px] text-fg-muted">Conectá tiendas WooCommerce como canal de venta. Cada sitio comparte el stock de su sucursal.</p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true) }}>Conectar sitio</Button>
      </div>

      {error && <p role="alert" className="text-[12px] text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">{error}</p>}

      {loading ? (
        <p className="text-[13px] text-fg-muted">Cargando…</p>
      ) : sites.length === 0 ? (
        <p className="text-[13px] text-fg-muted border border-dashed border-border rounded-sm p-6 text-center">
          No hay sitios conectados todavía.
        </p>
      ) : (
        <div className="border border-border rounded-sm divide-y divide-border">
          {sites.map(site => (
            <div key={site.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{site.name}</span>
                  <Badge status={site.is_active ? 'success' : 'neutral'}>{site.is_active ? 'Activo' : 'Inactivo'}</Badge>
                  {site.auto_publish && <Badge status="info">Auto-publicar</Badge>}
                </div>
                <div className="text-[12px] text-fg-muted truncate">
                  {site.store_url} · Sucursal: {branchName(site.branch_id)}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="secondary" onClick={() => setImporting(site)}>Importar</Button>
                <Button size="sm" variant="secondary" onClick={() => publishCatalog(site)} disabled={busyId === site.id}>
                  {busyId === site.id ? 'Publicando…' : 'Publicar catálogo'}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => { setEditing(site); setModalOpen(true) }}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleting(site)}>Eliminar</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <SiteModal
        open={modalOpen}
        site={editing}
        branches={branches}
        priceLists={priceLists}
        onClose={() => setModalOpen(false)}
        onSaved={() => setRefresh(r => r + 1)}
      />

      <ImportModal
        open={importing !== null}
        site={importing}
        onClose={() => setImporting(null)}
        onApplied={() => setRefresh(r => r + 1)}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={v => { if (!v) setDeleting(null) }}
        title="Eliminar sitio"
        description={`¿Eliminar la conexión con "${deleting?.name}"? Los pedidos ya importados se conservan.`}
        confirmLabel="Eliminar"
        onConfirm={confirmDelete}
      />
    </div>
  )
}
