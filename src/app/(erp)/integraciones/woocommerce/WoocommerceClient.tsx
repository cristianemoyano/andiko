'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { Button } from '@/components/primitives/Button'
import { Badge } from '@/components/primitives/Badge'
import { ConfirmDialog, DataTable, EmptyState, WooCommerceIcon } from '@/components/erp'
import type { Column } from '@/components/erp'
import { useCapabilities } from '@/components/layout/CapabilitiesContext'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { cn } from '@/lib/utils'
import { SiteModal, type SiteModalTab } from './SiteModal'
import type { WooSiteRow, OptionRow } from './types'

interface PaginatedResponse<T> { data: T[] }

interface WoocommerceSitesPanelProps {
  canWrite: boolean
  /** Oculta el encabezado cuando se embebe en Configuración. */
  embedded?: boolean
}

function WooConnectButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <Button
      size="sm"
      onClick={onClick}
      className={cn(
        'border-0 text-white shadow-sm',
        'bg-[#7F54B3] hover:bg-[#6d4799] active:bg-[#5c3d82] focus-visible:ring-[#7F54B3]',
        className,
      )}
    >
      <WooCommerceIcon size={18} variant="glyph" className="text-white" />
      Conectar sitio
    </Button>
  )
}

export function WoocommerceSitesPanel({ canWrite, embedded = false }: WoocommerceSitesPanelProps) {
  const [sites, setSites] = useState<WooSiteRow[]>([])
  const [branches, setBranches] = useState<OptionRow[]>([])
  const [priceLists, setPriceLists] = useState<OptionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<WooSiteRow | null>(null)
  const [modalTab, setModalTab] = useState<SiteModalTab>('conexion')
  const [deleting, setDeleting] = useState<WooSiteRow | null>(null)

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

  const branchName = useCallback(
    (id: string) => branches.find(b => b.id === id)?.name ?? '—',
    [branches],
  )

  function openModal(site: WooSiteRow | null, tab: SiteModalTab = 'conexion') {
    setEditing(site)
    setModalTab(tab)
    setModalOpen(true)
  }

  async function confirmDelete() {
    if (!deleting) return
    await fetchJson(`/api/v1/integrations/woocommerce/sites/${deleting.id}`, { method: 'DELETE' })
    setDeleting(null)
    setRefresh(r => r + 1)
  }

  const columns = useMemo((): Column<WooSiteRow>[] => [
    {
      key: 'name',
      header: 'Sitio',
      mobileRole: 'title',
      render: (site) => (
        <>
          <span className="font-medium text-fg truncate block">{site.name}</span>
          <a
            href={site.store_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-fg-muted hover:text-[#7F54B3] truncate block mt-0.5 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {site.store_url}
          </a>
        </>
      ),
    },
    {
      key: 'branch_id',
      header: 'Sucursal',
      mobileRole: 'subtitle',
      render: (site) => (
        <span className="text-[13px] text-fg-muted">{branchName(site.branch_id)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      mobileRole: 'badge',
      render: (site) => (
        <div className="flex flex-wrap gap-1.5">
          <Badge status={site.is_active ? 'success' : 'neutral'}>
            {site.is_active ? 'Activo' : 'Inactivo'}
          </Badge>
          {site.auto_publish && <Badge status="info">Auto-publicar</Badge>}
        </div>
      ),
    },
    ...(canWrite
      ? [{
          key: '_actions',
          header: '',
          align: 'right' as const,
          mobileRole: 'actions' as const,
          render: (site: WooSiteRow) => (
            <div className="flex items-center justify-end gap-1">
              <Button
                size="xs"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation()
                  openModal(site, 'conexion')
                }}
              >
                Editar
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleting(site)
                }}
              >
                Eliminar
              </Button>
            </div>
          ),
        }]
      : []),
  ], [canWrite, branchName])

  const showEmpty = !loading && sites.length === 0

  const siteCountLabel = loading
    ? 'Cargando…'
    : `${sites.length} sitio${sites.length !== 1 ? 's' : ''} conectado${sites.length !== 1 ? 's' : ''}`

  return (
    <div className={cn(
      'flex flex-col min-h-0 flex-1',
      embedded && 'w-full rounded-md border border-border bg-surface p-5',
    )}
    >
      <div className={cn(!embedded && 'mb-5')}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <WooCommerceIcon size={40} variant="mark" className="shrink-0" />
            <div className="min-w-0">
              {!embedded ? (
                <h1 className="text-[18px] font-semibold text-fg">WooCommerce</h1>
              ) : (
                <h2 className="text-[15px] font-semibold text-fg">WooCommerce</h2>
              )}
              <p className="text-[13px] text-fg-muted leading-snug mt-0.5">
                Conectá tiendas WooCommerce como canal de venta. Cada sitio comparte el stock de su sucursal.
              </p>
            </div>
          </div>
          {canWrite && (
            <WooConnectButton onClick={() => openModal(null)} className="shrink-0" />
          )}
        </div>
      </div>

      {!canWrite && (
        <p className={cn(
          'text-[12px] text-fg-muted bg-surface-muted',
          embedded
            ? 'rounded-sm px-3 py-2.5'
            : 'mb-4 rounded-md border border-border px-3 py-2.5',
        )}
        >
          Solo lectura. Pedí a un Gerente que modifique la configuración de integraciones.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className={cn(
            'text-[12px] text-danger bg-danger-bg',
            embedded
              ? 'rounded-sm border border-danger px-3 py-2.5'
              : 'mb-4 rounded-md border border-danger px-3 py-2.5',
          )}
        >
          {error}
        </p>
      )}

      {showEmpty ? (
        <EmptyState
          title="No hay sitios conectados"
          description="Conectá tu tienda WooCommerce para sincronizar catálogo, stock y pedidos con el ERP."
          icon={<WooCommerceIcon size={36} variant="mark" />}
          action={canWrite ? { label: 'Conectar sitio', onClick: () => openModal(null) } : undefined}
          className={cn('flex-1', embedded && 'mt-5 border-t border-border pt-8')}
        />
      ) : (
        <div className={cn(embedded && 'mt-5 border-t border-border pt-4')}>
          <p className="mb-3 text-[12px] text-fg-muted">
            {siteCountLabel}
          </p>
          <DataTable
            columns={columns}
            data={loading ? null : sites}
            keyExtractor={(site) => site.id}
            onRowClick={canWrite ? (site) => openModal(site, 'conexion') : undefined}
            emptyMessage={loading ? 'Cargando sitios…' : 'No hay sitios conectados.'}
            className={cn(
              embedded
                ? [
                  'border-0 rounded-none bg-transparent',
                  '[&_thead_th]:h-10 [&_tbody_td]:h-11',
                  '[&_thead_th]:px-4 [&_tbody_td]:px-4',
                  '[&_thead_th:first-child]:pl-0 [&_tbody_td:first-child]:pl-0',
                  '[&_thead_th:last-child]:pr-0 [&_tbody_td:last-child]:pr-0',
                ]
                : [
                  '[&_thead_th]:h-10 [&_tbody_td]:h-11',
                  '[&_thead_th]:px-4 [&_tbody_td]:px-4',
                ],
            )}
          />
        </div>
      )}

      {canWrite && (
        <>
          <SiteModal
            open={modalOpen}
            site={editing}
            branches={branches}
            priceLists={priceLists}
            initialTab={modalTab}
            onClose={() => setModalOpen(false)}
            onSaved={() => setRefresh(r => r + 1)}
          />

          <ConfirmDialog
            open={deleting !== null}
            onOpenChange={v => { if (!v) setDeleting(null) }}
            title="Eliminar sitio"
            description={`¿Eliminar la conexión con "${deleting?.name}"? Los pedidos ya importados se conservan.`}
            confirmLabel="Eliminar"
            onConfirm={confirmDelete}
          />
        </>
      )}
    </div>
  )
}

export function WoocommerceClient() {
  const { capabilities } = useCapabilities()
  const canWrite = capabilities?.integraciones.write ?? false

  return (
    <div className="flex flex-col h-full">
      <TopBar breadcrumbs={[{ label: 'Integraciones' }, { label: 'WooCommerce' }]} />
      <PageBody padding="p-6">
        <WoocommerceSitesPanel canWrite={canWrite} />
      </PageBody>
    </div>
  )
}
