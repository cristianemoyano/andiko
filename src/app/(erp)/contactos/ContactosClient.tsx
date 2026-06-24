'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { DropdownMenuItem } from '@/components/primitives/DropdownMenu'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { ContactModal } from './ContactModal'
import { ImportModal } from '@/components/erp/ImportModal'
import { formatContactPersonLabel } from '@/modules/contacts/contact.utils'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'
import { CONTACT_CSV_HEADERS } from '@/modules/contacts/contacts-csv-adapter'

type Contact = {
  id: string
  type: 'customer' | 'supplier' | 'both'
  legal_name: string
  trade_name: string | null
  first_name: string | null
  last_name: string | null
  job_title: string | null
  cuit: string | null
  iva_condition: string
  email: string | null
  phone: string | null
  is_active: boolean
}

type ContactType = 'customer' | 'supplier' | 'both' | ''

const TYPE_LABEL: Record<string, string> = {
  customer: 'Cliente',
  supplier: 'Proveedor',
  both:     'Ambos',
}

const PAGE_SIZE = 20

const IVA_LABEL: Record<string, string> = {
  responsable_inscripto: 'Resp. Inscripto',
  monotributista:        'Monotributista',
  consumidor_final:      'Cons. Final',
  exento:                'Exento',
  no_responsable:        'No responsable',
}

const COLUMNS: Column<Contact>[] = [
  {
    key: 'legal_name',
    header: 'Razón social',
    sortable: true,
    render: row => (
      <span className="font-medium text-fg">{row.legal_name}</span>
    ),
  },
  {
    key: 'trade_name',
    header: 'Nombre comercial',
    sortable: true,
    render: row => row.trade_name ?? <span className="text-fg-subtle">—</span>,
  },
  {
    key: 'contact_person',
    header: 'Persona de contacto',
    render: row => {
      const name = formatContactPersonLabel(row)
      if (!name && !row.job_title) return <span className="text-fg-subtle">—</span>
      if (name && !row.job_title) return <span className="text-[13px] text-fg">{name}</span>
      if (!name && row.job_title) return <span className="text-[13px] text-fg">{row.job_title}</span>
      return (
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] text-fg">{name}</span>
          <span className="text-[11px] text-fg-muted">{row.job_title}</span>
        </div>
      )
    },
  },
  {
    key: 'cuit',
    header: 'CUIT',
    render: row =>
      row.cuit ? (
        <span className="font-mono text-[12px] text-fg-muted">{row.cuit}</span>
      ) : (
        <span className="text-fg-subtle">—</span>
      ),
  },
  {
    key: 'type',
    header: 'Tipo',
    sortable: true,
    render: row => TYPE_LABEL[row.type] ?? row.type,
  },
  {
    key: 'iva_condition',
    header: 'Condición IVA',
    render: row => IVA_LABEL[row.iva_condition] ?? row.iva_condition,
  },
  {
    key: 'email',
    header: 'Email',
    render: row => row.email ?? <span className="text-fg-subtle">—</span>,
  },
  {
    key: 'is_active',
    header: 'Estado',
    render: row => (
      <StatusBadge value={row.is_active ? 'Aprobado' : 'Anulado'} />
    ),
  },
]

export function ContactosClient() {
  const router = useRouter()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState<ContactType>('')
  const [refresh, setRefresh]   = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState<Contact | null>(null)
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importSession, setImportSession] = useState(0)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
      ...(search     ? { search }     : {}),
      ...(typeFilter ? { type: typeFilter } : {}),
    })
    ;(async () => {
      setServerError(null)
      try {
        const data = await fetchJson<{ data: Contact[]; total: number }>(`/api/v1/contacts?${params}`)
        if (!mounted) return
        setContacts(data.data)
        setTotal(data.total)
        const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE))
        setPage(p => (p > pages ? pages : p))
      } catch (e) {
        if (!mounted) return
        setServerError(getApiErrorMessage(e))
        setContacts([])
        setTotal(0)
      }
    })()
    return () => { mounted = false }
  }, [page, search, typeFilter, refresh])

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(contact: Contact) {
    setEditing(contact)
    setModalOpen(true)
  }

  function handleSaved() {
    setModalOpen(false)
    setRefresh(r => r + 1)
  }

  async function handleDeleteContact() {
    if (!contactToDelete) return
    try {
      await fetchJson(`/api/v1/contacts/${contactToDelete.id}`, { method: 'DELETE' })
      setContactToDelete(null)
      notifySuccess('Contacto eliminado')
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    }
  }

  const columnsWithAction: Column<Contact>[] = [
    ...COLUMNS,
    {
      key: '_actions',
      header: '',
      mobileRole: 'actions' as const,
      render: row => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="xs" onClick={() => router.push(`/contactos/${row.id}`)}>
            Ver
          </Button>
          <Button variant="ghost" size="xs" onClick={() => openEdit(row)}>
            Editar
          </Button>
          <Button variant="ghost" size="xs" onClick={() => setContactToDelete(row)}>
            Eliminar
          </Button>
        </div>
      ),
      mobileRender: row => (
        <>
          <DropdownMenuItem onSelect={() => router.push(`/contactos/${row.id}`)}>Ver</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openEdit(row)}>Editar</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setContactToDelete(row)}>Eliminar</DropdownMenuItem>
        </>
      ),
    },
  ]

  function handleExport() {
    const params = new URLSearchParams({
      ...(search     ? { search }          : {}),
      ...(typeFilter ? { type: typeFilter } : {}),
    })
    const url = `/api/v1/contacts/export${params.size ? `?${params}` : ''}`
    window.location.href = url
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Contactos' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setImportSession(s => s + 1)
                setImportOpen(true)
              }}
            >
              Importar CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExport}>
              Exportar CSV
            </Button>
            <Button size="sm" onClick={openCreate}>
              + Nuevo contacto
            </Button>
          </div>
        }
      />

      <PageBody onRefresh={async () => setRefresh(r => r + 1)}>
        {serverError && (
          <div className="mb-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
            {serverError}
          </div>
        )}
        <DataTable
          columns={columnsWithAction}
          data={contacts}
          keyExtractor={r => r.id}
          emptyMessage="No hay contactos. Creá el primero."
          toolbar={
            <>
              <div className="relative flex items-center w-full sm:w-auto">
                <svg className="absolute left-2 text-fg-subtle pointer-events-none" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/>
                </svg>
                <input
                  className="pl-7 pr-3 h-[30px] text-[13px] border border-border-strong rounded-sm w-full sm:w-52 bg-surface focus:outline-none focus:border-ring"
                  placeholder="Buscar por razón social, persona, puesto o CUIT…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                />
              </div>

              <select
                className="h-[30px] text-[13px] border border-border-strong rounded-sm px-2 bg-surface focus:outline-none focus:border-ring text-fg-muted"
                value={typeFilter}
                onChange={e => { setTypeFilter(e.target.value as ContactType); setPage(1) }}
              >
                <option value="">Todos los tipos</option>
                <option value="customer">Clientes</option>
                <option value="supplier">Proveedores</option>
                <option value="both">Ambos</option>
              </select>

              <span className="flex-1" />
              <span className="text-[12px] text-fg-muted">{total} registro{total !== 1 ? 's' : ''}</span>
            </>
          }
          footer={
            total > 0 ? (
              <TablePagination
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
                onPageChange={setPage}
              />
            ) : undefined
          }
        />
      </PageBody>

      <ContactModal
        open={modalOpen}
        contact={editing}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={!!contactToDelete}
        onOpenChange={(open) => { if (!open) setContactToDelete(null) }}
        title="Eliminar contacto"
        description={contactToDelete ? `Se eliminará ${contactToDelete.legal_name}.` : ''}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDeleteContact}
      />

      <ImportModal
        key={importSession}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importar contactos"
        fields={CONTACT_CSV_HEADERS}
        requiredFields={['type', 'legal_name', 'iva_condition']}
        importUrl="/api/v1/contacts/import"
        onImported={() => {
          notifySuccess('Contactos importados correctamente')
          setRefresh(r => r + 1)
          setImportOpen(false)
        }}
      />
    </div>
  )
}
