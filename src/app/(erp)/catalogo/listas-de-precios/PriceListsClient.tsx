'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, type Column } from '@/components/erp'
import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { Dialog } from '@/components/primitives/Dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/primitives/DropdownMenu'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { PriceListDefaultHint } from '@/components/erp/PriceListDefaultHint'
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
  const [listToClone, setListToClone] = useState<PriceList | null>(null)
  const [cloning, setCloning] = useState(false)
  const [cloneError, setCloneError] = useState<string | null>(null)
  const [cloneForm, setCloneForm] = useState({ name: '', description: '' })
  const [listToEdit, setListToEdit] = useState<PriceList | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    is_default: false,
    is_active: true,
  })
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

  function openCloneModal(list: PriceList) {
    setListToClone(list)
    setCloneForm({
      name: `${list.name} (copia)`,
      description: list.description ?? '',
    })
    setCloneError(null)
  }

  function openEditModal(list: PriceList) {
    setListToEdit(list)
    setEditForm({
      name: list.name,
      description: list.description ?? '',
      is_default: list.is_default,
      is_active: list.is_active,
    })
    setEditError(null)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!listToEdit) return
    setEditSaving(true)
    setEditError(null)
    try {
      await fetchJson(`/api/v1/catalog/price-lists/${listToEdit.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editForm.name.trim(),
          description: editForm.description.trim() || null,
          is_default: editForm.is_default,
          is_active: editForm.is_active,
        }),
      })
      setListToEdit(null)
      notifySuccess('Lista actualizada')
      await reloadLists()
    } catch (err) {
      setEditError(getApiErrorMessage(err))
    } finally {
      setEditSaving(false)
    }
  }

  function renderRowActions(row: PriceList) {
    return (
      <div
        className="flex items-center justify-end gap-0.5"
        data-stop-row-click
        onClick={e => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="xs"
          onClick={() => router.push(`/catalogo/listas-de-precios/${row.id}`)}
        >
          Ver
        </Button>
        <Button variant="secondary" size="xs" onClick={() => openEditModal(row)}>
          Editar
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="xs" aria-label="Más acciones" className="px-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => openCloneModal(row)}>Clonar</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setListToDelete(row)}>
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  async function handleClone(e: React.FormEvent) {
    e.preventDefault()
    if (!listToClone) return
    setCloning(true)
    setCloneError(null)
    try {
      const created = await fetchJson<{ id: string; items_copied: number }>(
        `/api/v1/catalog/price-lists/${listToClone.id}/clone`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: cloneForm.name,
            description: cloneForm.description || null,
          }),
        },
      )
      setListToClone(null)
      notifySuccess(
        created.items_copied > 0
          ? `Lista clonada con ${created.items_copied} precios`
          : 'Lista clonada (sin precios en el origen)',
      )
      router.push(`/catalogo/listas-de-precios/${created.id}`)
    } catch (err) {
      setCloneError(getApiErrorMessage(err))
    } finally {
      setCloning(false)
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

      <PageBody padding="p-6">
        <PriceListDefaultHint className="mb-4" />
        <DataTable
          columns={[
            ...COLUMNS,
            {
              key: '_actions',
              header: '',
              className: 'w-[152px]',
              mobileRole: 'actions' as const,
              align: 'right',
              render: row => renderRowActions(row),
              mobileRender: row => (
                <>
                  <DropdownMenuItem onSelect={() => router.push(`/catalogo/listas-de-precios/${row.id}`)}>
                    Ver
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => openEditModal(row)}>Editar</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => openCloneModal(row)}>Clonar</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setListToDelete(row)}>
                    Eliminar
                  </DropdownMenuItem>
                </>
              ),
            },
          ]}
          data={loading ? [] : lists}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => router.push(`/catalogo/listas-de-precios/${row.id}`)}
          emptyMessage={loading ? 'Cargando…' : 'No hay listas de precios.'}
        />
      </PageBody>

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
              {form.is_default && <PriceListDefaultHint compact />}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
              <Button type="button" variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" size="sm" data-testid="price-list-create-btn" disabled={saving}>{saving ? 'Guardando…' : 'Crear lista'}</Button>
            </div>
          </form>
        </dialog>
      )}

      {listToClone && (
        <dialog
          open
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 w-full h-full p-4"
        >
          <form
            onSubmit={handleClone}
            className="bg-surface rounded-sm border border-border shadow-lg w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-fg">Clonar lista de precios</h2>
              <button
                type="button"
                onClick={() => setListToClone(null)}
                className="text-fg-subtle hover:text-fg-muted text-lg leading-none"
              >
                ×
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <p className="text-xs text-fg-muted">
                Se copiarán todos los precios de <span className="font-medium text-fg">{listToClone.name}</span> a una lista nueva.
              </p>
              {cloneError && (
                <div className="text-xs text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">{cloneError}</div>
              )}
              <FormField label="Nombre de la nueva lista *" htmlFor="clone_price_list_name">
                <Input
                  id="clone_price_list_name"
                  placeholder="Ej: Mayorista, Minorista…"
                  value={cloneForm.name}
                  onChange={e => setCloneForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </FormField>
              <FormField label="Descripción" htmlFor="clone_price_list_description">
                <Input
                  id="clone_price_list_description"
                  placeholder="Opcional"
                  value={cloneForm.description}
                  onChange={e => setCloneForm(f => ({ ...f, description: e.target.value }))}
                />
              </FormField>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
              <Button type="button" variant="secondary" size="sm" onClick={() => setListToClone(null)}>Cancelar</Button>
              <Button type="submit" size="sm" disabled={cloning}>{cloning ? 'Clonando…' : 'Clonar lista'}</Button>
            </div>
          </form>
        </dialog>
      )}

      <Dialog
        open={!!listToEdit}
        onOpenChange={open => { if (!open) setListToEdit(null) }}
        title="Editar lista de precios"
        size="sm"
      >
        <form onSubmit={handleEdit} className="flex flex-col gap-4">
          {editError && (
            <div className="text-xs text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">
              {editError}
            </div>
          )}
          <FormField label="Nombre *" htmlFor="list_edit_name">
            <Input
              id="list_edit_name"
              value={editForm.name}
              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              required
            />
          </FormField>
          <FormField label="Descripción" htmlFor="list_edit_description">
            <Input
              id="list_edit_description"
              value={editForm.description}
              onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Opcional"
            />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-fg-muted cursor-pointer">
            <input
              type="checkbox"
              checked={editForm.is_default}
              onChange={e => setEditForm(f => ({ ...f, is_default: e.target.checked }))}
              className="accent-brand-600"
            />
            Marcar como lista predeterminada
          </label>
          {editForm.is_default && <PriceListDefaultHint compact />}
          <label className="flex items-center gap-2 text-sm text-fg-muted cursor-pointer">
            <input
              type="checkbox"
              checked={editForm.is_active}
              onChange={e => setEditForm(f => ({ ...f, is_active: e.target.checked }))}
              className="accent-brand-600"
            />
            Lista activa
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setListToEdit(null)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={editSaving || !editForm.name.trim()}>
              {editSaving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </Dialog>

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
