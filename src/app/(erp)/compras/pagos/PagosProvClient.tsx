'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { Button } from '@/components/primitives/Button'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { ComprasSubNav } from '../ComprasSubNav'
import type { SupplierPayment, PaymentMethod } from '../types'
import { PAYMENT_METHOD_LABEL } from '../types'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

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
    render: row => <span className="font-mono text-[12px] text-fg-muted">{row.payment_number}</span>,
  },
  {
    key: 'invoice',
    header: 'Factura',
    render: row =>
      row.invoice ? (
        <span className="text-fg-muted font-mono text-[12px]">{row.invoice.invoice_number}</span>
      ) : (
        <span className="text-fg-subtle">—</span>
      ),
  },
  {
    key: 'contact',
    header: 'Proveedor',
    render: row =>
      row.contact ? (
        <span className="font-medium text-fg">{row.contact.legal_name}</span>
      ) : (
        <span className="text-fg-subtle">—</span>
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
  {
    key: 'actions',
    header: '',
    className: 'w-[88px]',
    render: row => (
      <Button asChild size="xs" variant="ghost">
        <Link href={`/compras/pagos/${row.id}/print`} target="_blank" rel="noopener noreferrer">
          Imprimir
        </Link>
      </Button>
    ),
  },
]

export function PagosProvClient() {
  const [payments, setPayments] = useState<PaymentRow[] | null>(null)
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    ;(async () => {
      try {
        const d = await fetchJson<{ data: PaymentRow[]; total: number }>(`/api/v1/purchases/supplier-payments?${params}`)
        if (!mounted) return
        setPayments(d.data ?? [])
        setTotal(d.total ?? 0)
        setError(null)
      } catch (e) {
        if (!mounted) return
        setError(getApiErrorMessage(e))
        setPayments([])
        setTotal(0)
      }
    })()
    return () => { mounted = false }
  }, [page])

  return (
    <div className="flex flex-col h-full">
      <TopBar breadcrumbs={[{ label: 'Compras', href: '/compras' }, { label: 'Pagos' }]} />
      <ComprasSubNav />

      <div className="flex-1 p-5 overflow-auto">
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <DataTable
          columns={COLUMNS}
          data={payments}
          keyExtractor={row => row.id}
          emptyMessage="No hay pagos registrados"
          toolbar={
            <>
              <span className="flex-1" />
              <span className="text-[12px] text-fg-muted">{total} registro{total !== 1 ? 's' : ''}</span>
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
