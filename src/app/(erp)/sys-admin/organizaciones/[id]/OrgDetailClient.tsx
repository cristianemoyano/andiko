'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { FormField } from '@/components/primitives/FormField'
import { DataTable, type Column } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { Dialog } from '@/components/primitives/Dialog'
import { BranchModal, type BranchRow } from './BranchModal'
import { OrgUserModal, type OrgUserRow } from './OrgUserModal'
import { slugifyText } from '@/lib/slug'
import { fetchJson, getApiErrorMessage, isApiRequestError } from '@/lib/fetch-json'
import { notifyApiError } from '@/lib/notify'

interface OrgPayload {
  id: string
  name: string
  slug: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface DetailResponse {
  organization: OrgPayload
  branches: BranchRow[]
}

interface OrgDetailClientProps {
  id: string
}

export function OrgDetailClient({ id }: OrgDetailClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [detail, setDetail] = useState<DetailResponse | null>(null)

  const [editOrgOpen, setEditOrgOpen] = useState(false)
  const [orgName, setOrgName] = useState('')
  const [orgSlug, setOrgSlug] = useState('')
  const [orgActive, setOrgActive] = useState(true)
  const [slugTouched, setSlugTouched] = useState(false)
  const [orgSaving, setOrgSaving] = useState(false)
  const [orgError, setOrgError] = useState<string | null>(null)

  const [branchModalOpen, setBranchModalOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<BranchRow | null>(null)
  const [confirmDeleteOrg, setConfirmDeleteOrg] = useState(false)
  const [confirmDeleteBranch, setConfirmDeleteBranch] = useState<BranchRow | null>(null)

  const [users, setUsers] = useState<OrgUserRow[]>([])
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<OrgUserRow | null>(null)
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<OrgUserRow | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      setLoading(true)
      try {
        const data = await fetchJson<DetailResponse>(`/api/v1/sys-admin/organizations/${id}`)
        if (cancelled) return
        setDetail(data)
        setOrgName(data.organization.name)
        setOrgSlug(data.organization.slug)
        setOrgActive(data.organization.is_active)
        setSlugTouched(false)
        setNotFound(false)
      } catch (e) {
        if (cancelled) return
        if (isApiRequestError(e) && e.status === 404) {
          setNotFound(true)
          setDetail(null)
        } else {
          setNotFound(false)
          setDetail(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, refresh])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const j = await fetchJson<{ data: OrgUserRow[] }>(`/api/v1/sys-admin/organizations/${id}/users`)
        if (cancelled) return
        setUsers(j.data ?? [])
      } catch {
        if (!cancelled) setUsers([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, refresh])

  async function handleSaveOrg(e: React.FormEvent) {
    e.preventDefault()
    setOrgSaving(true)
    setOrgError(null)
    try {
      await fetchJson(`/api/v1/sys-admin/organizations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: orgName.trim(),
          slug: orgSlug.trim().toLowerCase(),
          is_active: orgActive,
        }),
      })
      setEditOrgOpen(false)
      setRefresh(r => r + 1)
    } catch (e) {
      setOrgError(getApiErrorMessage(e))
    } finally {
      setOrgSaving(false)
    }
  }

  async function handleDeleteOrg() {
    setConfirmDeleteOrg(false)
    try {
      await fetchJson(`/api/v1/sys-admin/organizations/${id}`, { method: 'DELETE' })
      router.push('/sys-admin/organizaciones')
    } catch (e) {
      notifyApiError(e)
    }
  }

  async function handleDeleteBranch() {
    if (!confirmDeleteBranch) return
    const branchId = confirmDeleteBranch.id
    setConfirmDeleteBranch(null)
    try {
      await fetchJson(`/api/v1/sys-admin/branches/${branchId}`, { method: 'DELETE' })
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    }
  }

  async function handleDeleteUser() {
    if (!confirmDeleteUser) return
    const userId = confirmDeleteUser.id
    setConfirmDeleteUser(null)
    try {
      await fetchJson(`/api/v1/sys-admin/organizations/${id}/users/${userId}`, { method: 'DELETE' })
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    }
  }

  const roleLabel: Record<string, string> = {
    admin: 'Administrador',
    operator: 'Operador',
    readonly: 'Solo lectura',
  }

  const userColumns: Column<OrgUserRow>[] = [
    {
      key: 'email',
      header: 'Email',
      render: row => <span className="font-medium text-zinc-900">{row.email}</span>,
    },
    {
      key: 'name',
      header: 'Nombre',
      render: row => <span className="text-zinc-700 text-[13px]">{row.name}</span>,
    },
    {
      key: 'role',
      header: 'Rol',
      render: row => (
        <span className="text-[13px] text-zinc-600">{roleLabel[row.role] ?? row.role}</span>
      ),
    },
    {
      key: 'branches',
      header: 'Sucursales',
      render: (row) => {
        const branchList = detail?.branches ?? []
        const names = row.branch_ids
          .map(bid => branchList.find(b => b.id === bid)?.name)
          .filter((n): n is string => Boolean(n))
        return (
          <span className="text-[13px] text-zinc-600">{names.length ? names.join(', ') : '—'}</span>
        )
      },
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: row => <StatusBadge value={row.is_active ? 'Activo' : 'Inactivo'} />,
    },
    {
      key: '_actions',
      header: '',
      render: row => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              setEditingUser(row)
              setUserModalOpen(true)
            }}
          >
            Editar
          </Button>
          <Button variant="ghost" size="xs" onClick={() => setConfirmDeleteUser(row)}>
            Eliminar
          </Button>
        </div>
      ),
    },
  ]

  const branchColumns: Column<BranchRow>[] = [
    {
      key: 'branch_code',
      header: 'N°',
      render: row => (
        <span className="font-mono text-[12px] text-zinc-600">{String(row.branch_code).padStart(2, '0')}</span>
      ),
    },
    {
      key: 'name',
      header: 'Sucursal',
      render: row => <span className="font-medium text-zinc-900">{row.name}</span>,
    },
    {
      key: 'address',
      header: 'Dirección',
      render: row => (
        <span className="text-zinc-600 text-[13px]">{row.address ?? '—'}</span>
      ),
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: row => <StatusBadge value={row.is_active ? 'Activa' : 'Inactiva'} />,
    },
    {
      key: '_actions',
      header: '',
      render: row => (
        <div className="flex gap-1">
          <Button variant="ghost" size="xs" onClick={() => { setEditingBranch(row); setBranchModalOpen(true) }}>
            Editar
          </Button>
          <Button variant="ghost" size="xs" onClick={() => setConfirmDeleteBranch(row)}>
            Eliminar
          </Button>
        </div>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Sys-admin', href: '/sys-admin/organizaciones' }, { label: '…' }]} />
        <div className="flex-1 flex items-center justify-center text-[13px] text-zinc-400">Cargando…</div>
      </div>
    )
  }

  if (notFound || !detail) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Sys-admin', href: '/sys-admin/organizaciones' }, { label: 'No encontrado' }]} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
          <p className="text-[13px] text-zinc-600">Organización no encontrada.</p>
          <Link href="/sys-admin/organizaciones">
            <Button variant="secondary" size="sm">Volver al listado</Button>
          </Link>
        </div>
      </div>
    )
  }

  const org = detail.organization

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Sys-admin', href: '/sys-admin/organizaciones' },
          { label: 'Organizaciones', href: '/sys-admin/organizaciones' },
          { label: org.name },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteOrg(true)}>
              Eliminar organización
            </Button>
            <Button size="sm" onClick={() => setEditOrgOpen(true)}>
              Editar datos
            </Button>
          </div>
        }
      />

      <div className="flex-1 p-5 overflow-auto">
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
          <div className="bg-white border border-zinc-200 rounded-sm p-5">
            <p className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wide mb-2">Organización</p>
            <h1 className="text-[22px] font-bold text-zinc-900">{org.name}</h1>
            <p className="mt-2 text-[13px] text-zinc-600">
              Slug: <span className="font-mono">{org.slug}</span>
            </p>
            <div className="mt-3">
              <StatusBadge value={org.is_active ? 'Activa' : 'Inactiva'} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[14px] font-semibold text-zinc-900">Usuarios</h2>
              <Button
                size="sm"
                onClick={() => {
                  setEditingUser(null)
                  setUserModalOpen(true)
                }}
                disabled={detail.branches.filter(b => b.is_active).length === 0}
              >
                + Nuevo usuario
              </Button>
            </div>
            <DataTable
              columns={userColumns}
              data={users}
              keyExtractor={r => r.id}
              emptyMessage="No hay usuarios en esta organización."
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[14px] font-semibold text-zinc-900">Sucursales</h2>
              <Button
                size="sm"
                onClick={() => {
                  setEditingBranch(null)
                  setBranchModalOpen(true)
                }}
              >
                + Nueva sucursal
              </Button>
            </div>
            <DataTable
              columns={branchColumns}
              data={detail.branches}
              keyExtractor={r => r.id}
              emptyMessage="No hay sucursales. Creá la primera."
            />
          </div>
        </div>
      </div>

      <Dialog open={editOrgOpen} onOpenChange={v => { if (!v) setEditOrgOpen(false) }} title="Editar organización" size="md">
        <form onSubmit={handleSaveOrg} className="flex flex-col gap-4">
          <FormField label="Nombre" htmlFor="edit_org_name">
            <Input
              id="edit_org_name"
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              onBlur={() => {
                if (!slugTouched && orgName.trim()) setOrgSlug(slugifyText(orgName))
              }}
              required
            />
          </FormField>
          <FormField label="Slug" htmlFor="edit_org_slug">
            <Input
              id="edit_org_slug"
              value={orgSlug}
              onChange={e => { setSlugTouched(true); setOrgSlug(e.target.value) }}
              required
            />
          </FormField>
          <label className="flex items-center gap-2 text-[13px] text-zinc-700 cursor-pointer">
            <input
              type="checkbox"
              checked={orgActive}
              onChange={e => setOrgActive(e.target.checked)}
              className="rounded border-zinc-300"
            />
            Organización activa
          </label>
          {orgError && (
            <p role="alert" className="text-[12px] text-red-600">{orgError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditOrgOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={orgSaving}>
              {orgSaving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </Dialog>

      <BranchModal
        open={branchModalOpen}
        orgId={id}
        branch={editingBranch}
        onClose={() => { setBranchModalOpen(false); setEditingBranch(null) }}
        onSaved={() => setRefresh(r => r + 1)}
      />

      <OrgUserModal
        open={userModalOpen}
        orgId={id}
        branches={detail.branches}
        user={editingUser}
        onClose={() => { setUserModalOpen(false); setEditingUser(null) }}
        onSaved={() => setRefresh(r => r + 1)}
      />

      <ConfirmDialog
        open={confirmDeleteOrg}
        onOpenChange={setConfirmDeleteOrg}
        title="Eliminar organización"
        description="Se eliminará la organización y sus sucursales de forma lógica. Los datos vinculados en otros módulos pueden verse afectados."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDeleteOrg}
      />

      <ConfirmDialog
        open={!!confirmDeleteBranch}
        onOpenChange={open => { if (!open) setConfirmDeleteBranch(null) }}
        title="Eliminar sucursal"
        description={
          confirmDeleteBranch
            ? `¿Eliminar la sucursal «${confirmDeleteBranch.name}»?`
            : ''
        }
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDeleteBranch}
      />

      <ConfirmDialog
        open={!!confirmDeleteUser}
        onOpenChange={open => { if (!open) setConfirmDeleteUser(null) }}
        title="Eliminar usuario"
        description={
          confirmDeleteUser
            ? `¿Eliminar el usuario «${confirmDeleteUser.email}»? Se desactivará el acceso al ERP.`
            : ''
        }
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDeleteUser}
      />
    </div>
  )
}
