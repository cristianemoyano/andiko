'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
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
import { SearchableSelect, type SearchableSelectOption } from '@/components/erp/SearchableSelect'
import { formatCuit } from '@/modules/contacts/contact.utils'
import { slugifyText } from '@/lib/slug'
import { fetchJson, getApiErrorMessage, isApiRequestError } from '@/lib/fetch-json'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'
import { notifyApiError } from '@/lib/notify'
import { ORG_MODULE_DEFS, type OrgModuleKey } from '@/modules/auth/organization-modules'
import { getBuiltinRoleLabel } from '@/modules/auth/role-labels'
import { orgApiPaths } from '@/lib/org-api-paths'
import { canManageOrgUserFromList } from '@/lib/org-user-management-access'
import { useCapabilities } from '@/components/layout/CapabilitiesContext'
import { RolePermissionMatrix } from '@/components/erp/RolePermissionMatrix'

interface OrgPayload {
  id: string
  name: string
  slug: string
  is_active: boolean
  legal_name: string | null
  cuit: string | null
  iva_condition: string | null
  fiscal_address: string | null
  created_at: string
  updated_at: string
}

const IVA_CONDITION_OPTIONS: SearchableSelectOption[] = [
  { value: 'responsable_inscripto', label: 'Responsable Inscripto' },
  { value: 'monotributista', label: 'Monotributista' },
  { value: 'consumidor_final', label: 'Consumidor Final' },
  { value: 'exento', label: 'Exento' },
  { value: 'no_responsable', label: 'No Responsable' },
]

const IVA_CONDITION_LABEL: Record<string, string> = Object.fromEntries(
  IVA_CONDITION_OPTIONS.map(o => [o.value, o.label]),
)

interface DetailResponse {
  organization: OrgPayload
  branches: BranchRow[]
}

interface OrgSettingsPayload {
  org_id: string
  enabled_modules: OrgModuleKey[]
  enabled_features: Record<string, boolean>
  is_default: boolean
}

interface OrgDetailClientProps {
  id: string
}

export function OrgDetailClient({ id }: OrgDetailClientProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const { capabilities, refreshCapabilities } = useCapabilities()
  const ui = capabilities?.organizacion
  const nav = capabilities?.nav
  const api = orgApiPaths(ui?.apiNamespace ?? 'settings', id)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [detail, setDetail] = useState<DetailResponse | null>(null)

  const [editOrgOpen, setEditOrgOpen] = useState(false)
  const [orgName, setOrgName] = useState('')
  const [orgSlug, setOrgSlug] = useState('')
  const [orgActive, setOrgActive] = useState(true)
  const [slugTouched, setSlugTouched] = useState(false)
  const [orgLegalName, setOrgLegalName] = useState('')
  const [orgCuit, setOrgCuit] = useState('')
  const [orgIvaCondition, setOrgIvaCondition] = useState<string | null>(null)
  const [orgFiscalAddress, setOrgFiscalAddress] = useState('')
  const [orgSaving, setOrgSaving] = useState(false)
  const [orgError, setOrgError] = useState<string | null>(null)
  const [orgFieldErrors, setOrgFieldErrors] = useState<Record<string, string[]>>({})

  const [branchModalOpen, setBranchModalOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<BranchRow | null>(null)
  const [confirmDeleteOrg, setConfirmDeleteOrg] = useState(false)
  const [confirmDeleteBranch, setConfirmDeleteBranch] = useState<BranchRow | null>(null)

  const [users, setUsers] = useState<OrgUserRow[]>([])
  const [usersLoadError, setUsersLoadError] = useState<string | null>(null)
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<OrgUserRow | null>(null)
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<OrgUserRow | null>(null)

  const [enabledModules, setEnabledModules] = useState<OrgModuleKey[]>([])
  const [settingsDefault, setSettingsDefault] = useState(true)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      setLoading(true)
      try {
        const data = await fetchJson<DetailResponse>(api.organization)
        if (cancelled) return
        setDetail(data)
        setOrgName(data.organization.name)
        setOrgSlug(data.organization.slug)
        setOrgActive(data.organization.is_active)
        setOrgLegalName(data.organization.legal_name ?? '')
        setOrgCuit(data.organization.cuit ?? '')
        setOrgIvaCondition(data.organization.iva_condition)
        setOrgFiscalAddress(data.organization.fiscal_address ?? '')
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
  }, [id, refresh, api.organization])

  useEffect(() => {
    if (!ui?.sections.users) return
    let cancelled = false
    void (async () => {
      try {
        const j = await fetchJson<{ data: OrgUserRow[] }>(api.users)
        if (cancelled) return
        setUsers(j.data ?? [])
        setUsersLoadError(null)
      } catch (e) {
        if (!cancelled) {
          setUsers([])
          setUsersLoadError(getApiErrorMessage(e))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, refresh, api.users, ui?.sections.users])

  useEffect(() => {
    if (!ui?.sections.enabledModules || !api.settings) return
    let cancelled = false
    void (async () => {
      try {
        const settings = await fetchJson<OrgSettingsPayload>(api.settings)
        if (cancelled) return
        setEnabledModules(settings.enabled_modules ?? [])
        setSettingsDefault(settings.is_default)
        setSettingsError(null)
      } catch {
        if (!cancelled) setEnabledModules([])
      }
    })()
    return () => { cancelled = true }
  }, [id, refresh, api.settings, ui?.sections.enabledModules])

  async function handleSaveOrg(e: React.FormEvent) {
    e.preventDefault()
    if (!ui) return
    setOrgSaving(true)
    setOrgError(null)
    setOrgFieldErrors({})
    try {
      const fiscalBody = {
        legal_name: orgLegalName.trim() || null,
        cuit: orgCuit.trim() || null,
        iva_condition: orgIvaCondition || null,
        fiscal_address: orgFiscalAddress.trim() || null,
      }
      const body = ui.sections.orgMetaEdit
        ? {
            name: orgName.trim(),
            slug: orgSlug.trim().toLowerCase(),
            is_active: orgActive,
            ...fiscalBody,
          }
        : fiscalBody

      await fetchJson(api.organization, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      setEditOrgOpen(false)
      setRefresh(r => r + 1)
    } catch (e) {
      const fe = fieldErrorsFromApiError(e)
      if (fe) setOrgFieldErrors(fe)
      else setOrgError(getApiErrorMessage(e))
    } finally {
      setOrgSaving(false)
    }
  }

  async function handleSaveSettings() {
    if (!api.settings) return
    setSettingsSaving(true)
    setSettingsError(null)
    try {
      const settings = await fetchJson<OrgSettingsPayload>(api.settings, {
        method: 'PATCH',
        body: JSON.stringify({ enabled_modules: enabledModules }),
      })
      setEnabledModules(settings.enabled_modules ?? [])
      setSettingsDefault(settings.is_default)
    } catch (e) {
      setSettingsError(getApiErrorMessage(e))
    } finally {
      setSettingsSaving(false)
    }
  }

  function toggleModule(key: OrgModuleKey) {
    setEnabledModules(prev =>
      prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key],
    )
  }

  async function handleDeleteOrg() {
    setConfirmDeleteOrg(false)
    try {
      await fetchJson(api.organization, { method: 'DELETE' })
      router.push('/organizaciones')
    } catch (e) {
      notifyApiError(e)
    }
  }

  async function handleDeleteBranch() {
    if (!confirmDeleteBranch) return
    const branchId = confirmDeleteBranch.id
    setConfirmDeleteBranch(null)
    try {
      await fetchJson(api.branch(branchId), { method: 'DELETE' })
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
      await fetchJson(api.user(userId), { method: 'DELETE' })
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    }
  }

  const roleLabel = (row: OrgUserRow) =>
    row.org_role_name ?? getBuiltinRoleLabel(row.role)

  const actorId = session?.user?.impersonation?.userId ?? session?.user?.id ?? null
  const bypassUserManagementRules =
    session?.user?.realRole === 'sys-admin' && !session?.user?.impersonation

  function canManageUser(row: OrgUserRow): boolean {
    if (bypassUserManagementRules || !actorId || !session?.user) return true
    return canManageOrgUserFromList(
      {
        id: actorId,
        role: session.user.role,
        org_role_id: session.user.orgRoleId ?? null,
      },
      {
        id: row.id,
        role: row.role,
        org_role_id: row.org_role_id,
      },
    )
  }

  if (!ui || !nav) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Organización' }]} />
        <div className="flex-1 flex items-center justify-center text-[13px] text-fg-subtle">Cargando…</div>
      </div>
    )
  }

  const listHref = nav.organizacionesHref === `/organizaciones/${id}` ? null : nav.organizacionesHref

  const breadcrumbs = listHref
    ? [{ label: 'Organizaciones', href: listHref }, { label: detail?.organization.name ?? '…' }]
    : [{ label: detail?.organization.name ?? '…' }]

  const userColumns: Column<OrgUserRow>[] = [
    {
      key: 'email',
      header: 'Email',
      render: row => <span className="font-medium text-fg">{row.email}</span>,
    },
    {
      key: 'name',
      header: 'Nombre',
      render: row => (
        <span className="text-fg-muted text-[13px]">
          {[row.first_name, row.last_name].filter(Boolean).join(' ') || row.name}
        </span>
      ),
    },
    {
      key: 'role',
      header: 'Rol',
      render: row => (
        <span className="text-[13px] text-fg-muted">
          {row.org_role_name ?? roleLabel(row)}
        </span>
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
          <span className="text-[13px] text-fg-muted">{names.length ? names.join(', ') : '—'}</span>
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
      mobileRole: 'actions' as const,
      render: row => (
        <div className="flex gap-1">
          {ui.actions.editUser && actorId === row.id && !bypassUserManagementRules && (
            <Link href="/perfil">
              <Button variant="ghost" size="xs">
                Perfil
              </Button>
            </Link>
          )}
          {ui.actions.editUser && canManageUser(row) && (
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
          )}
          {ui.actions.deleteUser && canManageUser(row) && (
            <Button variant="ghost" size="xs" onClick={() => setConfirmDeleteUser(row)}>
              Eliminar
            </Button>
          )}
        </div>
      ),
    },
  ]

  const branchColumns: Column<BranchRow>[] = [
    {
      key: 'branch_code',
      header: 'N°',
      render: row => (
        <span className="font-mono text-[12px] text-fg-muted">{String(row.branch_code).padStart(2, '0')}</span>
      ),
    },
    {
      key: 'name',
      header: 'Sucursal',
      render: row => <span className="font-medium text-fg">{row.name}</span>,
    },
    {
      key: 'address',
      header: 'Dirección',
      render: row => (
        <span className="text-fg-muted text-[13px]">{row.address ?? '—'}</span>
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
      mobileRole: 'actions' as const,
      render: row => (
        <div className="flex gap-1">
          {ui.actions.editBranch && (
            <Button variant="ghost" size="xs" onClick={() => { setEditingBranch(row); setBranchModalOpen(true) }}>
              Editar
            </Button>
          )}
          {ui.actions.deleteBranch && (
            <Button variant="ghost" size="xs" onClick={() => setConfirmDeleteBranch(row)}>
              Eliminar
            </Button>
          )}
        </div>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={breadcrumbs} />
        <div className="flex-1 flex items-center justify-center text-[13px] text-fg-subtle">Cargando…</div>
      </div>
    )
  }

  if (notFound || !detail) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'No encontrado' }]} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
          <p className="text-[13px] text-fg-muted">Organización no encontrada.</p>
          {listHref && (
            <Link href={listHref}>
              <Button variant="secondary" size="sm">Volver al listado</Button>
            </Link>
          )}
        </div>
      </div>
    )
  }

  const org = detail.organization

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={breadcrumbs}
        actions={
          (ui.sections.deleteOrg || ui.sections.fiscalEdit || ui.sections.orgMetaEdit) ? (
            <div className="flex gap-2">
              {ui.sections.deleteOrg && (
                <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteOrg(true)}>
                  Eliminar organización
                </Button>
              )}
              {(ui.sections.fiscalEdit || ui.sections.orgMetaEdit) && (
                <Button size="sm" onClick={() => setEditOrgOpen(true)}>
                  Editar datos
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      <div className="flex-1 p-5 overflow-auto">
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
          <div className="bg-surface border border-border rounded-sm p-5">
            <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide mb-2">Organización</p>
            <h1 className="text-[22px] font-bold text-fg">{org.name}</h1>
            <p className="mt-2 text-[13px] text-fg-muted">
              Slug: <span className="font-mono">{org.slug}</span>
            </p>
            <div className="mt-3">
              <StatusBadge value={org.is_active ? 'Activa' : 'Inactiva'} />
            </div>
            {ui.sections.fiscal && (
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide sm:col-span-2">Datos fiscales</p>
              <div>
                <p className="text-[12px] text-fg-muted">Razón social legal</p>
                <p className="text-[13px] text-fg">{org.legal_name ?? '—'}</p>
              </div>
              <div>
                <p className="text-[12px] text-fg-muted">CUIT</p>
                <p className="text-[13px] text-fg font-mono">{org.cuit ?? '—'}</p>
              </div>
              <div>
                <p className="text-[12px] text-fg-muted">Condición IVA</p>
                <p className="text-[13px] text-fg">
                  {org.iva_condition ? IVA_CONDITION_LABEL[org.iva_condition] ?? org.iva_condition : '—'}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-fg-muted">Domicilio fiscal</p>
                <p className="text-[13px] text-fg">{org.fiscal_address ?? '—'}</p>
              </div>
            </div>
            )}
          </div>

          {ui.sections.enabledModules && (
          <div className="bg-surface border border-border rounded-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide">Módulos habilitados</p>
                {settingsDefault ? (
                  <p className="mt-1 text-[12px] text-fg-muted">Usando configuración por defecto (todos los módulos).</p>
                ) : null}
              </div>
              <Button size="sm" onClick={() => void handleSaveSettings()} disabled={settingsSaving}>
                {settingsSaving ? 'Guardando…' : 'Guardar módulos'}
              </Button>
            </div>
            {settingsError ? (
              <p role="alert" className="mb-3 text-[12px] text-danger">{settingsError}</p>
            ) : null}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(['base', 'premium'] as const).map(tier => (
                <div key={tier}>
                  <p className="mb-2 text-[12px] font-medium text-fg-muted capitalize">{tier === 'base' ? 'Base' : 'Premium'}</p>
                  <ul className="space-y-2">
                    {ORG_MODULE_DEFS.filter(m => m.tier === tier).map(mod => (
                      <li key={mod.key}>
                        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-fg">
                          <input
                            type="checkbox"
                            checked={enabledModules.includes(mod.key)}
                            onChange={() => toggleModule(mod.key)}
                            className="h-3.5 w-3.5 accent-brand-600"
                          />
                          {mod.label}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          )}

          {ui.sections.rolesMatrix && (
            <div className="bg-surface border border-border rounded-sm p-5">
              <RolePermissionMatrix
                orgId={id}
                apiNamespace={ui.apiNamespace}
                canEdit={ui.actions.saveRolesMatrix}
              />
            </div>
          )}

          {ui.sections.users && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[14px] font-semibold text-fg">Usuarios</h2>
              {ui.actions.createUser && (
              <Button
                size="sm"
                onClick={() => {
                  setEditingUser(null)
                  setUserModalOpen(true)
                }}
                disabled={detail.branches.filter(b => b.is_active).length === 0}
                title={
                  detail.branches.filter(b => b.is_active).length === 0
                    ? 'Creá al menos una sucursal activa antes de agregar usuarios'
                    : undefined
                }
              >
                + Nuevo usuario
              </Button>
              )}
            </div>
            {detail.branches.filter(b => b.is_active).length === 0 && (
              <div
                role="status"
                className="mb-3 flex flex-col gap-2.5 rounded-sm border border-warning bg-warning-bg px-3 py-2.5 text-[12px] text-warning sm:flex-row sm:items-center sm:justify-between"
              >
                <p>Creá al menos una sucursal activa antes de agregar usuarios.</p>
                {ui.actions.createBranch && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    onClick={() => {
                      setEditingBranch(null)
                      setBranchModalOpen(true)
                    }}
                  >
                    + Nueva sucursal
                  </Button>
                )}
              </div>
            )}
            {usersLoadError ? (
              <p role="alert" className="mb-3 rounded-sm border border-danger bg-danger-bg px-3 py-2 text-[12px] text-danger">
                {usersLoadError}
              </p>
            ) : null}
            <DataTable
              columns={userColumns}
              data={users}
              keyExtractor={r => r.id}
              onRowClick={row => { setEditingUser(row); setUserModalOpen(true) }}
              emptyMessage="No hay usuarios en esta organización."
            />
          </div>
          )}

          {ui.sections.branches && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[14px] font-semibold text-fg">Sucursales</h2>
              {ui.actions.createBranch && (
              <Button
                size="sm"
                onClick={() => {
                  setEditingBranch(null)
                  setBranchModalOpen(true)
                }}
              >
                + Nueva sucursal
              </Button>
              )}
            </div>
            <DataTable
              columns={branchColumns}
              data={detail.branches}
              keyExtractor={r => r.id}
              onRowClick={row => { setEditingBranch(row); setBranchModalOpen(true) }}
              emptyMessage="No hay sucursales. Creá la primera."
            />
          </div>
          )}
        </div>
      </div>

      <Dialog open={editOrgOpen} onOpenChange={v => { if (!v) setEditOrgOpen(false) }} title={ui.sections.orgMetaEdit ? 'Editar organización' : 'Editar datos fiscales'} size="md">
        <form onSubmit={handleSaveOrg} className="flex flex-col gap-4">
          {ui.sections.orgMetaEdit && (
          <>
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
          </>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Razón social legal" htmlFor="edit_org_legal_name" error={orgFieldErrors.legal_name?.[0]}>
              <Input
                id="edit_org_legal_name"
                value={orgLegalName}
                onChange={e => setOrgLegalName(e.target.value)}
                placeholder="Razón social registrada en AFIP"
                error={!!orgFieldErrors.legal_name}
              />
            </FormField>
            <FormField label="CUIT" htmlFor="edit_org_cuit" error={orgFieldErrors.cuit?.[0]}>
              <Input
                id="edit_org_cuit"
                value={orgCuit}
                onChange={e => setOrgCuit(e.target.value)}
                onBlur={() => { if (orgCuit.trim()) setOrgCuit(formatCuit(orgCuit.trim())) }}
                placeholder="XX-XXXXXXXX-X"
                error={!!orgFieldErrors.cuit}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Condición IVA" htmlFor="edit_org_iva" error={orgFieldErrors.iva_condition?.[0]}>
              <SearchableSelect
                value={orgIvaCondition}
                onChange={setOrgIvaCondition}
                options={IVA_CONDITION_OPTIONS}
                placeholder="Seleccionar…"
              />
            </FormField>
            <FormField label="Domicilio fiscal" htmlFor="edit_org_fiscal_address" error={orgFieldErrors.fiscal_address?.[0]}>
              <Input
                id="edit_org_fiscal_address"
                value={orgFiscalAddress}
                onChange={e => setOrgFiscalAddress(e.target.value)}
                placeholder="Calle, número, ciudad, provincia"
                error={!!orgFieldErrors.fiscal_address}
              />
            </FormField>
          </div>
          {ui.sections.orgMetaEdit && (
          <label className="flex items-center gap-2 text-[13px] text-fg-muted cursor-pointer">
            <input
              type="checkbox"
              checked={orgActive}
              onChange={e => setOrgActive(e.target.checked)}
              className="rounded border-border-strong"
            />
            Organización activa
          </label>
          )}
          {orgError && (
            <p role="alert" className="text-[12px] text-danger">{orgError}</p>
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
        apiNamespace={ui.apiNamespace}
        branch={editingBranch}
        onClose={() => { setBranchModalOpen(false); setEditingBranch(null) }}
        onSaved={() => setRefresh(r => r + 1)}
      />

      <OrgUserModal
        open={userModalOpen}
        orgId={id}
        apiNamespace={ui.apiNamespace}
        branches={detail.branches}
        user={editingUser}
        onClose={() => { setUserModalOpen(false); setEditingUser(null) }}
        onSaved={() => {
          setRefresh(r => r + 1)
          void refreshCapabilities()
        }}
      />

      {ui.sections.deleteOrg && (
      <ConfirmDialog
        open={confirmDeleteOrg}
        onOpenChange={setConfirmDeleteOrg}
        title="Eliminar organización"
        description="Se eliminará la organización y sus sucursales de forma lógica. Los datos vinculados en otros módulos pueden verse afectados."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDeleteOrg}
      />
      )}

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
