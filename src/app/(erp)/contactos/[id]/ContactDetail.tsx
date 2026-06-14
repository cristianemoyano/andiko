'use client'

import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { StatusBadge, Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { ContactModal } from '../ContactModal'
import { AddressesSection } from './AddressesSection'
import { PaymentInfoSection } from './PaymentInfoSection'
import { fetchJson } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'
import type { PaymentInfo } from './PaymentInfoSection'

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
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

type Address = {
  id: string
  type: 'fiscal' | 'delivery' | 'commercial'
  street: string
  number: string | null
  floor: string | null
  apartment: string | null
  city: string
  province: string
  postal_code: string | null
  country: string
  is_default: boolean
}

const TYPE_LABEL: Record<string, string> = {
  customer: 'Cliente',
  supplier: 'Proveedor',
  both:     'Ambos',
}

const IVA_LABEL: Record<string, string> = {
  responsable_inscripto: 'Responsable Inscripto',
  monotributista:        'Monotributista',
  consumidor_final:      'Consumidor Final',
  exento:                'Exento',
  no_responsable:        'No Responsable',
}

export function ContactDetail({ contact: initial, addresses, paymentInfo }: { contact: Contact; addresses: Address[]; paymentInfo: PaymentInfo[] }) {
  const [contact, setContact] = useState(initial)
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleSaved() {
    setModalOpen(false)
    try {
      const updated = await fetchJson<Contact>(`/api/v1/contacts/${contact.id}`)
      setContact(updated)
    } catch (e) {
      notifyApiError(e)
    }
  }

  async function handleDelete() {
    try {
      await fetchJson(`/api/v1/contacts/${contact.id}`, { method: 'DELETE' })
      setConfirmDelete(false)
      notifySuccess('Contacto eliminado')
      window.location.assign('/contactos')
    } catch (e) {
      setConfirmDelete(false)
      notifyApiError(e)
    }
  }

  const createdAt = new Date(contact.created_at).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
  const updatedAt = new Date(contact.updated_at).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Contactos', href: '/contactos' },
          { label: contact.legal_name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>
              Eliminar
            </Button>
            <Button size="sm" onClick={() => setModalOpen(true)}>
              Editar
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-5">
        <div className="flex flex-col gap-4">

          {/* Header card */}
          <div className="bg-white border border-zinc-200 rounded p-5 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[18px] font-semibold text-zinc-900 tracking-tight">
                {contact.legal_name}
              </h1>
              {contact.trade_name && (
                <p className="text-[13px] text-zinc-500 mt-0.5">{contact.trade_name}</p>
              )}
              <div className="flex items-center gap-2 mt-3">
                <Badge status="neutral">{TYPE_LABEL[contact.type]}</Badge>
                <StatusBadge value={contact.is_active ? 'Aprobado' : 'Anulado'} />
              </div>
            </div>
            {contact.cuit && (
              <div className="text-right flex-shrink-0">
                <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1">CUIT</div>
                <div className="font-mono text-[14px] text-zinc-800">{contact.cuit}</div>
              </div>
            )}
          </div>

          {/* Datos fiscales */}
          <Section title="Datos fiscales">
            <Row label="Condición IVA" value={IVA_LABEL[contact.iva_condition] ?? contact.iva_condition} />
            <Row label="Tipo" value={TYPE_LABEL[contact.type] ?? contact.type} />
            {contact.cuit && <Row label="CUIT" value={contact.cuit} mono />}
          </Section>

          {/* Datos de contacto */}
          <Section title="Datos de contacto">
            <Row label="Nombre" value={contact.first_name} empty="—" />
            <Row label="Apellido" value={contact.last_name} empty="—" />
            <Row label="Puesto en la empresa" value={contact.job_title} empty="—" />
            <Row label="Email" value={contact.email} empty="—" />
            <Row label="Teléfono" value={contact.phone} empty="—" />
          </Section>

          {/* Direcciones */}
          <AddressesSection contactId={contact.id} initialAddresses={addresses} />

          {/* Datos de pago */}
          <PaymentInfoSection contactId={contact.id} initialPaymentInfo={paymentInfo} />

          {/* Notas */}
          {contact.notes && (
            <Section title="Notas">
              <p className="text-[13px] text-zinc-700 leading-relaxed">{contact.notes}</p>
            </Section>
          )}

          {/* Metadata */}
          <div className="text-[11px] text-zinc-400 flex gap-4">
            <span>Creado: {createdAt}</span>
            <span>Modificado: {updatedAt}</span>
          </div>
        </div>
      </div>

      <ContactModal
        open={modalOpen}
        contact={contact}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Eliminar contacto"
        description={`Se eliminará ${contact.legal_name}.`}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
      />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-zinc-200 rounded overflow-hidden">
      <div className="px-4 py-2.5 border-b border-zinc-100 bg-zinc-50">
        <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">{title}</span>
      </div>
      <div className="divide-y divide-zinc-100">{children}</div>
    </div>
  )
}

function Row({ label, value, empty = null, mono = false }: {
  label: string
  value: string | null | undefined
  empty?: string | null
  mono?: boolean
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center px-4 py-2.5 gap-0.5 sm:gap-4">
      <span className="text-[12px] text-zinc-500 w-full sm:w-36 flex-shrink-0">{label}</span>
      <span className={`text-[13px] ${mono ? 'font-mono text-zinc-700' : 'text-zinc-900'}`}>
        {value ?? empty ?? <span className="text-zinc-400">—</span>}
      </span>
    </div>
  )
}
