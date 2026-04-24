'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { ComprasSubNav } from '../ComprasSubNav'
import type { SupplierPayment, PaymentMethod } from '../types'
import { PAYMENT_METHOD_LABEL } from '../types'

type PaymentRow = SupplierPayment & {
  invoice?: { id: string; invoice_number: string } | null
  contact?: { legal_name: string } | null
  branch?: { name: string } | null
}

const PAGE_SIZE = 20

const COLUMNS: Column<PaymentRow>[] = [
  {
    key: 'payment_number',
    header: 'N°',
    render: row => <span className="font-mono text-[12px] text-zinc-600">{row.payment_number}</span>,
  },
  {
    key: 'invoice',
    header: 'Factura',
    render: row =>
      row.invoice ? (
        <span className="text-zinc-700 font-mono text-[12px]">{row.invoice.invoice_number}</span>
      ) : (
        <span className="text-zinc-400">—</span>
      ),
  },
  {
    key: 'contact',
    header: 'Proveedor',
    render: row =>
      row.contact ? (
        <span className="font-medium text-zinc-900">{row.contact.legal_name}</span>
      ) : (
        <span className="text-zinc-400">—</span>
      ),
  },
  {
    key: 'payment_date',
    header: 'Fecha',
    render: row => new Date(row.payment_date).toLocaleDateString('es-AR'),
  },
  {
    key: 'payment_method',
    header: 'Método',
    render: row => PAYMENT_METHOD_LABEL[row.payment_method as PaymentMethod] ?? row.payment_method,
  },
  {
    key: 'amount',
    header: 'Monto',
    render: row => <span className="tabular-nums font-medium">{formatARS(row.amount)}</span>,
  },
]

export function PagosProvClient() {
  const [payments, setPayments] = useState<PaymentRow[] | null>(null)
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    fetch(`/api/v1/purchases/supplier-payments?${params}`)
      .then(r => r.json())
      .then(d => { setPayments(d.data ?? []); setTotal(d.total ?? 0); setError(null) })
      .catch(() => setError('Error al cargar los pagos'))
  }, [page])

  return (
    <div className="flex flex-col h-full">
      <TopBar breadcrumbs={[{ label: 'Compras', href: '/compras' }, { label: 'Pagos' }]} />
      <ComprasSubNav />

      <div className="flex-1 p-5 overflow-auto">
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <DataTable
          columns={COLUMNS}
          data={payments}
          keyExtractor={row => row.id}
          emptyMessage="No hay pagos registrados"
          toolbar={
            <>
              <span className="flex-1" />
              <span className="text-[12px] text-zinc-500">{total} registro{total !== 1 ? 's' : ''}</span>
            </>
          }
          footer={
            total > 0 ? (
              <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            ) : undefined
          }
        />
      </div>
    </div>
  )
}
