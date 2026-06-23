'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, type Column } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'
import { ContabilidadSubNav } from '../ContabilidadSubNav'
import { CuentaModal } from './CuentaModal'
import { ACCOUNT_TYPE_LABEL, type Account } from '../types'

function depthOf(code: string): number {
  return Math.max(0, code.split('.').length - 1)
}

export function PlanDeCuentasClient() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [serverError, setServerError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [toDelete, setToDelete] = useState<Account | null>(null)

  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams({ all: 'true' })
    if (typeFilter) params.set('type', typeFilter)
    if (search) params.set('search', search)
    ;(async () => {
      setServerError(null)
      try {
        const data = await fetchJson<{ data: Account[] }>(`/api/v1/accounting/accounts?${params}`)
        if (!mounted) return
        setAccounts(data.data)
      } catch (e) {
        if (!mounted) return
        setServerError(getApiErrorMessage(e))
        setAccounts([])
      }
    })()
    return () => { mounted = false }
  }, [typeFilter, search, refresh])

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(account: Account) {
    setEditing(account)
    setModalOpen(true)
  }

  function handleSaved() {
    setModalOpen(false)
    setRefresh(r => r + 1)
  }

  async function handleDelete() {
    if (!toDelete) return
    try {
      await fetchJson(`/api/v1/accounting/accounts/${toDelete.id}`, { method: 'DELETE' })
      setToDelete(null)
      notifySuccess('Cuenta eliminada')
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    }
  }

  const columns: Column<Account>[] = [
    {
      key: 'code',
      header: 'Código',
      render: row => (
        <span className="font-mono text-[12px] text-fg-muted">{row.code}</span>
      ),
    },
    {
      key: 'name',
      header: 'Nombre',
      render: row => (
        <span
          className={row.is_postable ? 'text-fg' : 'font-semibold text-fg'}
          style={{ paddingLeft: `${depthOf(row.code) * 16}px` }}
        >
          {row.name}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Tipo',
      render: row => <span className="text-[12px] text-fg-muted">{ACCOUNT_TYPE_LABEL[row.type] ?? row.type}</span>,
    },
    {
      key: 'is_postable',
      header: 'Imputable',
      render: row => (
        <span className="text-[12px] text-fg-muted">{row.is_postable ? 'Sí' : 'No'}</span>
      ),
    },
    {
      key: 'is_active',
      header: 'Estado',
      render: row => <StatusBadge value={row.is_active ? 'Aprobado' : 'Anulado'} />,
    },
    {
      key: '_actions',
      header: '',
      mobileRole: 'actions' as const,
      render: row => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="xs" onClick={() => openEdit(row)}>Editar</Button>
          <Button variant="ghost" size="xs" onClick={() => setToDelete(row)}>Eliminar</Button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Contabilidad', href: '/contabilidad/asientos' }, { label: 'Plan de cuentas' }]}
        actions={<Button size="sm" onClick={openCreate}>+ Nueva cuenta</Button>}
      />
      <ContabilidadSubNav />

      <PageBody>
        {serverError && (
          <div className="mb-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
            {serverError}
          </div>
        )}
        <DataTable
          columns={columns}
          data={accounts}
          keyExtractor={r => r.id}
          emptyMessage="No hay cuentas."
          toolbar={
            <>
              <div className="relative flex items-center w-full sm:w-auto">
                <svg className="absolute left-2 text-fg-subtle pointer-events-none" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/>
                </svg>
                <input
                  className="pl-7 pr-3 h-[30px] text-[13px] border border-border-strong rounded-sm w-full sm:w-56 bg-surface focus:outline-none focus:border-ring"
                  placeholder="Buscar por código o nombre…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <select
                className="h-[30px] text-[13px] border border-border-strong rounded-sm px-2 bg-surface focus:outline-none focus:border-ring text-fg-muted"
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
              >
                <option value="">Todos los tipos</option>
                {Object.entries(ACCOUNT_TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <span className="flex-1" />
              <span className="text-[12px] text-fg-muted">{accounts.length} cuenta{accounts.length !== 1 ? 's' : ''}</span>
            </>
          }
        />
      </PageBody>

      <CuentaModal
        open={modalOpen}
        account={editing}
        accounts={accounts}
        onOpenChange={setModalOpen}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => { if (!open) setToDelete(null) }}
        title="Eliminar cuenta"
        description={toDelete ? `Se eliminará la cuenta ${toDelete.code} — ${toDelete.name}.` : ''}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
      />
    </div>
  )
}
