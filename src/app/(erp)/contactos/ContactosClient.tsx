'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { StatusBadge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { ContactModal } from './ContactModal'

type Contact = {
  id: string
  type: 'customer' | 'supplier' | 'both'
  legal_name: string
  trade_name: string | null
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
      <span className="font-medium text-zinc-900">{row.legal_name}</span>
    ),
  },
  {
    key: 'trade_name',
    header: 'Nombre comercial',
    sortable: true,
    render: row => row.trade_name ?? <span className="text-zinc-400">—</span>,
  },
  {
    key: 'cuit',
    header: 'CUIT',
    render: row =>
      row.cuit ? (
        <span className="font-mono text-[12px] text-zinc-600">{row.cuit}</span>
      ) : (
        <span className="text-zinc-400">—</span>
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
    render: row => row.email ?? <span className="text-zinc-400">—</span>,
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

  useEffect(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: '20',
      ...(search     ? { search }     : {}),
      ...(typeFilter ? { type: typeFilter } : {}),
    })
    fetch(`/api/v1/contacts?${params}`)
      .then(r => r.json() as Promise<{ data: Contact[]; total: number }>)
      .then(data => {
        setContacts(data.data)
        setTotal(data.total)
      })
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

  const columnsWithAction: Column<Contact>[] = [
    ...COLUMNS,
    {
      key: '_actions',
      header: '',
      render: row => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="xs" onClick={() => router.push(`/contactos/${row.id}`)}>
            Ver
          </Button>
          <Button variant="ghost" size="xs" onClick={() => openEdit(row)}>
            Editar
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Contactos' }]}
        actions={
          <Button size="sm" onClick={openCreate}>
            + Nuevo contacto
          </Button>
        }
      />

      <div className="flex-1 p-5 overflow-auto">
        <DataTable
          columns={columnsWithAction}
          data={contacts}
          keyExtractor={r => r.id}
          emptyMessage="No hay contactos. Creá el primero."
          toolbar={
            <>
              <div className="relative flex items-center">
                <svg className="absolute left-2 text-zinc-400 pointer-events-none" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/>
                </svg>
                <input
                  className="pl-7 pr-3 h-[30px] text-[13px] border border-zinc-300 rounded-sm w-52 bg-white focus:outline-none focus:border-blue-500"
                  placeholder="Buscar por nombre o CUIT…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                />
              </div>

              <select
                className="h-[30px] text-[13px] border border-zinc-300 rounded-sm px-2 bg-white focus:outline-none focus:border-blue-500 text-zinc-700"
                value={typeFilter}
                onChange={e => { setTypeFilter(e.target.value as ContactType); setPage(1) }}
              >
                <option value="">Todos los tipos</option>
                <option value="customer">Clientes</option>
                <option value="supplier">Proveedores</option>
                <option value="both">Ambos</option>
              </select>

              <span className="flex-1" />
              <span className="text-[12px] text-zinc-500">{total} registro{total !== 1 ? 's' : ''}</span>
            </>
          }
          footer={
            total > 20 ? (
              <div className="flex items-center gap-3">
                <Button variant="secondary" size="xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  ← Anterior
                </Button>
                <span className="text-[12px] text-zinc-500">Pág. {page} de {Math.ceil(total / 20)}</span>
                <Button variant="secondary" size="xs" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>
                  Siguiente →
                </Button>
              </div>
            ) : undefined
          }
        />
      </div>

      <ContactModal
        open={modalOpen}
        contact={editing}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  )
}
