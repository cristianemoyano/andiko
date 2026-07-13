'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { ExpensasSubNav } from '../ExpensasSubNav'
import type { ExpensePayment, PaymentMethod } from '../types'
import { PAYMENT_METHOD_LABEL } from '../types'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

type PaymentRow = ExpensePayment & {
  expense?: { id: string; expense_number: string } | null
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
    key: 'expense',
    header: 'Gasto',
    render: row =>
      row.expense ? (
        <span className="text-fg-muted font-mono text-[12px]">{row.expense.expense_number}</span>
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
]

export function PagosExpensasClient() {
  const router = useRouter()
  const [payments, setPayments] = useState<PaymentRow[] | null>(null)
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    ;(async () => {
      try {
        const d = await fetchJson<{ data: PaymentRow[]; total: number }>(`/api/v1/expenses/expense-payments?${params}`)
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
      <TopBar breadcrumbs={[{ label: 'Expensas', href: '/expensas' }, { label: 'Pagos' }]} />
      <ExpensasSubNav />

      <PageBody>
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <DataTable
          columns={COLUMNS}
          data={payments}
          keyExtractor={row => row.id}
          onRowClick={row => row.expense && router.push(`/expensas/facturas/${row.expense.id}`)}
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
      </PageBody>
    </div>
  )
}
