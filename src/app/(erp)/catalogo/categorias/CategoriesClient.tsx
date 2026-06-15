'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { fieldErrorsFromApiError } from '@/lib/validation-errors'

type Category = {
  id: string
  name: string
  description: string | null
  status: 'active' | 'archived'
  parent_id: string | null
}

const STATUS_LABEL: Record<Category['status'], string> = {
  active: 'Activa',
  archived: 'Archivada',
}

const STATUS_BADGE: Record<Category['status'], 'success' | 'neutral'> = {
  active: 'success',
  archived: 'neutral',
}

type FieldErrors = Record<string, string[]>

export function CategoriesClient() {
  const [rows, setRows] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<Category['status'] | ''>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [view, setView] = useState<'table' | 'tree'>('tree')
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)

  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [loadingAll, setLoadingAll] = useState(false)

  const [form, setForm] = useState({
    name: '',
    description: '',
    status: 'active' as Category['status'],
    parent_id: '',
  })

  const loadFiltered = useCallback(async () => {
    setLoading(true)
    setLoadingAll(true)
    const params = new URLSearchParams({ page: '1', limit: '100' })
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    try {
      const data = await fetchJson<{ data?: Category[] }>(`/api/v1/catalog/categories?${params}`)
      const list = Array.isArray(data?.data) ? data.data : []
      setRows(list)
      setAllCategories(list)
    } catch (e) {
      setRows([])
      setAllCategories([])
      notifyApiError(e)
    } finally {
      setLoading(false)
      setLoadingAll(false)
    }
  }, [search, status])

  const loadAllForParentSelect = useCallback(async () => {
    setLoadingAll(true)
    try {
      const data = await fetchJson<{ data?: Category[] }>('/api/v1/catalog/categories?page=1&limit=100')
      setAllCategories(Array.isArray(data?.data) ? data.data : [])
    } catch (e) {
      notifyApiError(e)
    } finally {
      setLoadingAll(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { loadFiltered() }, 250)
    return () => clearTimeout(t)
  }, [loadFiltered])

  const parentNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of allCategories) m.set(c.id, c.name)
    return m
  }, [allCategories])

  const childrenByParentId = useMemo(() => {
    const m = new Map<string | null, Category[]>()
    for (const c of allCategories) {
      const key = c.parent_id ?? null
      const arr = m.get(key) ?? []
      arr.push(c)
      m.set(key, arr)
    }
    for (const [, arr] of m) arr.sort((a, b) => a.name.localeCompare(b.name, 'es'))
    return m
  }, [allCategories])

  const rootCategories = useMemo(() => childrenByParentId.get(null) ?? [], [childrenByParentId])

  const COLUMNS: Column<Category>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Nombre',
      sortable: true,
      render: row => <span className="font-medium text-fg">{row.name}</span>,
    },
    {
      key: 'parent',
      header: 'Padre',
      render: row =>
        row.parent_id
          ? <span className="text-fg-muted">{parentNameById.get(row.parent_id) ?? '—'}</span>
          : <span className="text-fg-subtle">—</span>,
    },
    {
      key: 'description',
      header: 'Descripción',
      render: row => row.description ?? <span className="text-fg-subtle">—</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      render: row => (
        <Badge status={STATUS_BADGE[row.status] ?? 'neutral'}>
          {STATUS_LABEL[row.status] ?? row.status}
        </Badge>
      ),
    },
  ], [parentNameById])

  function openCreate() {
    setEditing(null)
    setErrors({})
    setServerError(null)
    setForm({ name: '', description: '', status: 'active', parent_id: '' })
    loadAllForParentSelect()
    setModalOpen(true)
  }

  function openEdit(c: Category) {
    setEditing(c)
    setErrors({})
    setServerError(null)
    setForm({ name: c.name, description: c.description ?? '', status: c.status, parent_id: c.parent_id ?? '' })
    loadAllForParentSelect()
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    setServerError(null)

    const body = {
      name: form.name,
      description: form.description || null,
      status: form.status,
      parent_id: form.parent_id ? form.parent_id : null,
    }
    const url = editing ? `/api/v1/catalog/categories/${editing.id}` : '/api/v1/catalog/categories'
    const method = editing ? 'PATCH' : 'POST'

    try {
      await fetchJson(url, { method, body: JSON.stringify(body) })
      setModalOpen(false)
      await loadFiltered()
    } catch (err) {
      const fe = fieldErrorsFromApiError(err)
      if (fe) setErrors(fe)
      else setServerError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteConfirmed() {
    if (!categoryToDelete) return
    try {
      await fetchJson(`/api/v1/catalog/categories/${categoryToDelete.id}`, { method: 'DELETE' })
      setCategoryToDelete(null)
      notifySuccess('Categoría eliminada')
      await loadFiltered()
    } catch (e) {
      notifyApiError(e)
    }
  }

  const columnsWithActions: Column<Category>[] = [
    ...COLUMNS,
    {
      key: '_actions',
      header: '',
      align: 'right',
      render: row => (
        <div className="flex items-center gap-1 justify-end">
          <Button variant="ghost" size="xs" onClick={() => openEdit(row)}>Editar</Button>
          <Button variant="ghost" size="xs" onClick={() => setCategoryToDelete(row)}>Eliminar</Button>
        </div>
      ),
    },
  ]

  function TreeRow({ node, depth }: { node: Category; depth: number }) {
    const children = childrenByParentId.get(node.id) ?? []
    const [open, setOpen] = useState(true)

    return (
      <div className="border-b border-border last:border-0">
        <div
          className="flex items-center gap-2 h-10 px-3 hover:bg-surface-muted"
          style={{ paddingLeft: 12 + depth * 18 }}
        >
          {children.length > 0 ? (
            <button
              type="button"
              className="w-5 h-5 text-fg-muted hover:text-fg"
              onClick={() => setOpen(o => !o)}
              title={open ? 'Contraer' : 'Expandir'}
            >
              {open ? '▾' : '▸'}
            </button>
          ) : (
            <span className="w-5 h-5" />
          )}

          <span className="font-medium text-[13px] text-fg">{node.name}</span>
          <Badge status={STATUS_BADGE[node.status] ?? 'neutral'}>
            {STATUS_LABEL[node.status] ?? node.status}
          </Badge>
          {node.description && <span className="text-[12px] text-fg-subtle truncate">{node.description}</span>}

          <span className="flex-1" />
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="xs" onClick={() => openEdit(node)}>Editar</Button>
            <Button variant="ghost" size="xs" onClick={() => setCategoryToDelete(node)}>Eliminar</Button>
          </div>
        </div>

        {open && children.length > 0 && (
          <div>
            {children.map(child => (
              <TreeRow key={child.id} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Catálogo', href: '/catalogo/productos' },
          { label: 'Categorías' },
        ]}
        actions={<Button size="sm" onClick={openCreate}>+ Nueva categoría</Button>}
      />
      <CatalogoSubNav />

      <div className="flex-1 p-5 overflow-auto">
        {view === 'table' ? (
          <DataTable
            columns={columnsWithActions}
            data={loading ? [] : rows}
            keyExtractor={(r) => r.id}
            emptyMessage={loading ? 'Cargando…' : 'No hay categorías.'}
            toolbar={
              <>
                <div className="relative flex items-center w-full sm:w-auto">
                  <svg className="absolute left-2 text-fg-subtle pointer-events-none" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/>
                  </svg>
                  <input
                    className="pl-7 pr-3 h-[30px] text-[13px] border border-border-strong rounded-sm w-full sm:w-56 bg-surface focus:outline-none focus:border-ring"
                    placeholder="Buscar por nombre…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  className="h-[30px] text-[13px] border border-border-strong rounded-sm px-2 bg-surface focus:outline-none focus:border-ring text-fg-muted"
                  value={status}
                onChange={(e) => setStatus(e.target.value as (Category['status'] | ''))}
                >
                  <option value="">Todos los estados</option>
                  <option value="active">Activas</option>
                  <option value="archived">Archivadas</option>
                </select>

                <Button size="sm" variant="secondary" onClick={() => setView('tree')}>Árbol</Button>

                <span className="flex-1" />
              </>
            }
          />
        ) : (
          <div className="bg-surface border border-border rounded">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
              <div className="relative flex items-center w-full sm:w-auto">
                <svg className="absolute left-2 text-fg-subtle pointer-events-none" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/>
                </svg>
                <input
                  className="pl-7 pr-3 h-[30px] text-[13px] border border-border-strong rounded-sm w-full sm:w-56 bg-surface focus:outline-none focus:border-ring"
                  placeholder="Buscar por nombre…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="h-[30px] text-[13px] border border-border-strong rounded-sm px-2 bg-surface focus:outline-none focus:border-ring text-fg-muted"
                value={status}
                onChange={(e) => setStatus(e.target.value as (Category['status'] | ''))}
              >
                <option value="">Todos los estados</option>
                <option value="active">Activas</option>
                <option value="archived">Archivadas</option>
              </select>
              <Button size="sm" variant="secondary" onClick={() => setView('table')}>Tabla</Button>
              <span className="flex-1" />
            </div>

            <div>
              {loadingAll ? (
                <div className="h-20 flex items-center justify-center text-sm text-fg-subtle">Cargando…</div>
              ) : rootCategories.length === 0 ? (
                <div className="h-20 flex items-center justify-center text-sm text-fg-subtle">No hay categorías.</div>
              ) : (
                rootCategories.map(c => <TreeRow key={c.id} node={c} depth={0} />)
              )}
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <dialog
          open
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 w-full h-full p-4"
          onClick={(e) => { if (e.currentTarget === e.target) setModalOpen(false) }}
        >
          <form
            onSubmit={handleSubmit}
            className="bg-surface rounded-sm border border-border shadow-lg w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-fg">
                {editing ? 'Editar categoría' : 'Nueva categoría'}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-fg-subtle hover:text-fg-muted text-lg leading-none">×</button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {serverError && (
                <div className="text-xs text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">{serverError}</div>
              )}

              <FormField label="Nombre *" htmlFor="cat_name" error={errors.name?.[0]} required>
                <Input
                  id="cat_name"
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  error={!!errors.name?.[0]}
                  required
                />
              </FormField>

              <FormField label="Descripción" htmlFor="cat_desc" error={errors.description?.[0]}>
                <Input
                  id="cat_desc"
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  error={!!errors.description?.[0]}
                />
              </FormField>

              <FormField label="Estado" htmlFor="cat_status" error={errors.status?.[0]}>
                <select
                  id="cat_status"
                  value={form.status}
                  onChange={(e) => setForm(f => ({ ...f, status: e.target.value as Category['status'] }))}
                  className="h-8 w-full px-2 text-sm border border-border-strong rounded-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="active">Activa</option>
                  <option value="archived">Archivada</option>
                </select>
              </FormField>

              <FormField label="Categoría padre" htmlFor="cat_parent" error={errors.parent_id?.[0]}>
                <select
                  id="cat_parent"
                  value={form.parent_id}
                  onChange={(e) => setForm(f => ({ ...f, parent_id: e.target.value }))}
                  className="h-8 w-full px-2 text-sm border border-border-strong rounded-sm focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-surface-hover disabled:text-fg-subtle"
                  disabled={loadingAll}
                >
                  <option value="">{loadingAll ? 'Cargando…' : 'Sin padre'}</option>
                  {allCategories
                    .filter(c => !editing || c.id !== editing.id)
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.status === 'archived' ? ' (archivada)' : ''}
                      </option>
                    ))}
                </select>
              </FormField>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
              <Button type="button" variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" size="sm" disabled={saving}>{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear categoría'}</Button>
            </div>
          </form>
        </dialog>
      )}

      <ConfirmDialog
        open={!!categoryToDelete}
        onOpenChange={(open) => { if (!open) setCategoryToDelete(null) }}
        title="Eliminar categoría"
        description={categoryToDelete ? `Se eliminará ${categoryToDelete.name}.` : ''}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  )
}

