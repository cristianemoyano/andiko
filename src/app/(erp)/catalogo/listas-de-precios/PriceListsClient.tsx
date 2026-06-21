'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { DataTable, type Column } from '@/components/erp'
import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { CatalogoSubNav } from '../CatalogoSubNav'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'

type PriceList = {
  id: string
  name: string
  description: string | null
  is_default: boolean
  is_active: boolean
  created_at: string
}

const COLUMNS: Column<PriceList>[] = [
  {
    key: 'name',
    header: 'Nombre',
    sortable: true,
    render: row => (
      <span className="font-medium text-fg" data-testid="price-list-row" data-price-list-name={row.name}>
        {row.name}
        {row.is_default && (
          <Badge status="info" className="ml-2">Predeterminada</Badge>
        )}
      </span>
    ),
  },
  {
    key: 'description',
    header: 'Descripción',
    render: row => row.description ?? <span className="text-fg-subtle">—</span>,
  },
  {
    key: 'is_active',
    header: 'Estado',
    render: row => (
      <Badge status={row.is_active ? 'success' : 'neutral'}>
        {row.is_active ? 'Activa' : 'Inactiva'}
      </Badge>
    ),
  },
]

export function PriceListsClient() {
  const router = useRouter()
  const [lists, setLists]         = useState<PriceList[]>([])
  const [loading, setLoading]     = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [listToDelete, setListToDelete] = useState<PriceList | null>(null)
  const [form, setForm] = useState({ name: '', description: '', is_default: false })

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const data = await fetchJson<{ data: PriceList[] }>('/api/v1/catalog/price-lists?limit=100')
        if (mounted) setLists(data.data)
      } catch (e) {
        if (mounted) {
          setLists([])
          notifyApiError(e)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      await fetchJson('/api/v1/catalog/price-lists', {
        method: 'POST',
        body: JSON.stringify({ name: form.name, description: form.description || null, is_default: form.is_default }),
      })
      setModalOpen(false)
      setForm({ name: '', description: '', is_default: false })
      notifySuccess('Lista creada')
      await reloadLists()
    } catch (e) {
      setFormError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function reloadLists() {
    setLoading(true)
    try {
      const data = await fetchJson<{ data: PriceList[] }>('/api/v1/catalog/price-lists?limit=100')
      setLists(data.data)
    } catch (e) {
      notifyApiError(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeletePriceList() {
    if (!listToDelete) return
    try {
      await fetchJson(`/api/v1/catalog/price-lists/${listToDelete.id}`, { method: 'DELETE' })
      setListToDelete(null)
      notifySuccess('Lista eliminada')
      await reloadLists()
    } catch (e) {
      notifyApiError(e)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Catálogo', href: '/catalogo/productos' },
          { label: 'Listas de precios' },
        ]}
        actions={
          <Button size="sm" data-testid="new-price-list-btn" onClick={() => setModalOpen(true)}>+ Nueva lista</Button>
        }
      />
      <CatalogoSubNav />

      <div className="flex-1 overflow-auto p-6">
        <DataTable
          columns={[
            ...COLUMNS,
            {
              key: '_actions',
              header: '',
              align: 'right',
              render: row => (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    setListToDelete(row)
                  }}
                >
                  Eliminar
                </Button>
              ),
            },
          ]}
          data={loading ? [] : lists}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => router.push(`/catalogo/listas-de-precios/${row.id}`)}
          emptyMessage={loading ? 'Cargando…' : 'No hay listas de precios.'}
        />
      </div>

      {modalOpen && (
        <dialog
          open
          data-testid="price-list-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 w-full h-full p-4"
        >
          <form
            onSubmit={handleCreate}
            className="bg-surface rounded-sm border border-border shadow-lg w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-fg">Nueva lista de precios</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-fg-subtle hover:text-fg-muted text-lg leading-none">×</button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {formError && (
                <div className="text-xs text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">{formError}</div>
              )}
              <FormField label="Nombre *" htmlFor="price_list_name">
                <Input
                  id="price_list_name"
                  data-testid="price-list-name-input"
                  placeholder="Ej: Mayorista, Minorista…"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </FormField>
              <FormField label="Descripción" htmlFor="price_list_description">
                <Input
                  id="price_list_description"
                  placeholder="Opcional"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </FormField>
              <label className="flex items-center gap-2 text-sm text-fg-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))}
                  className="accent-brand-600"
                />
                Marcar como lista predeterminada
              </label>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
              <Button type="button" variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" size="sm" data-testid="price-list-create-btn" disabled={saving}>{saving ? 'Guardando…' : 'Crear lista'}</Button>
            </div>
          </form>
        </dialog>
      )}

      <ConfirmDialog
        open={!!listToDelete}
        onOpenChange={(open) => { if (!open) setListToDelete(null) }}
        title="Eliminar lista de precios"
        description={listToDelete ? `Se eliminará ${listToDelete.name}.` : ''}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDeletePriceList}
      />
    </div>
  )
}
