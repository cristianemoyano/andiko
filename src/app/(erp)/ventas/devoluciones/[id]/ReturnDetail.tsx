'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { PageActionBar, type PageAction } from '@/components/erp/PageActionBar'
import { StatusBadge } from '@/components/primitives/Badge'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { VentasSubNav } from '../../VentasSubNav'
import { fetchJson } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'

type ReturnDetailData = {
  id: string
  return_number: string
  operation_type: 'return' | 'exchange'
  status: 'draft' | 'confirmed' | 'completed' | 'cancelled'
  order_id: string
  invoice_id: string | null
  credit_note_id: string | null
  returned_total: string
  exchange_total: string
  difference_total: string
  reason: string | null
  order?: { order_number: string } | null
  creditNote?: { id: string; credit_note_number: string; cae: string | null } | null
  items?: Array<{ description: string; quantity: string; total: string }>
  exchangeItems?: Array<{ description: string; quantity: string; total: string }>
}

const RETURN_STATUS_LABEL: Record<ReturnDetailData['status'], string> = {
  draft:     'Borrador',
  confirmed: 'Confirmada',
  completed: 'Completada',
  cancelled: 'Anulada',
}

export function ReturnDetail() {
  const { id } = useParams<{ id: string }>()
  const [row, setRow] = useState<ReturnDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const data = await fetchJson<ReturnDetailData>(`/api/v1/sales/returns/${id}`)
        if (!cancelled) setRow(data)
      } catch (e) {
        if (!cancelled) notifyApiError(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id, refresh])

  const runAction = async (path: string, body: unknown, successMsg: string) => {
    setBusy(true)
    try {
      await fetchJson(`/api/v1/sales/returns/${id}/${path}`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      notifySuccess(successMsg)
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    } finally {
      setBusy(false)
    }
  }

  const primary: PageAction | null = row?.status === 'draft'
    ? { id: 'confirm', label: 'Confirmar recepción', onClick: () => void runAction('confirm', {}, 'Recepción confirmada'), disabled: busy }
    : row?.status === 'confirmed'
      ? { id: 'complete', label: 'Completar', onClick: () => setConfirmComplete(true), disabled: busy }
      : null

  const secondary: PageAction[] = row && row.status !== 'completed' && row.status !== 'cancelled'
    ? [{ id: 'cancel', label: 'Anular', onClick: () => setConfirmCancel(true), disabled: busy, variant: 'destructive' }]
    : []

  if (loading) return <div className="p-8 text-fg-muted">Cargando…</div>
  if (!row) return <div className="p-8 text-danger">Devolución no encontrada</div>

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Ventas', href: '/ventas/presupuestos' },
          { label: 'Devoluciones', href: '/ventas/devoluciones' },
          { label: row.return_number },
        ]}
        actions={<PageActionBar primary={primary} secondary={secondary} />}
      />
      <VentasSubNav />
      <PageBody>
        <div className="max-w-3xl mx-auto flex flex-col gap-4">
          <div className="bg-surface border border-border rounded-sm p-5">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h1 className="text-xl font-bold">{row.return_number}</h1>
              <StatusBadge value={RETURN_STATUS_LABEL[row.status]} />
            </div>
            <dl className="grid grid-cols-2 gap-3 text-[13px]">
              <div><dt className="text-fg-subtle">Pedido</dt><dd><Link href={`/ventas/pedidos/${row.order_id}`} className="text-brand-600 hover:underline">{row.order?.order_number}</Link></dd></div>
              <div><dt className="text-fg-subtle">Tipo</dt><dd>{row.operation_type === 'exchange' ? 'Cambio' : 'Devolución'}</dd></div>
              <div><dt className="text-fg-subtle">Total devuelto</dt><dd>{formatARS(row.returned_total)}</dd></div>
              {row.operation_type === 'exchange' && (
                <>
                  <div><dt className="text-fg-subtle">Total nuevo</dt><dd>{formatARS(row.exchange_total)}</dd></div>
                  <div><dt className="text-fg-subtle">Diferencia</dt><dd>{formatARS(row.difference_total)}</dd></div>
                </>
              )}
              {row.creditNote && (
                <div className="col-span-2">
                  <dt className="text-fg-subtle">Nota de crédito</dt>
                  <dd>
                    <Link href={`/ventas/notas-de-credito/${row.creditNote.id}`} className="text-brand-600 hover:underline">
                      {row.creditNote.credit_note_number}
                    </Link>
                    {row.creditNote.cae ? ` — CAE ${row.creditNote.cae}` : null}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {(row.items?.length ?? 0) > 0 && (
            <div className="bg-surface border border-border rounded-sm p-5">
              <h2 className="font-semibold mb-3">Ítems devueltos</h2>
              <ul className="text-[13px] space-y-1">
                {row.items!.map((item, i) => (
                  <li key={i} className="flex justify-between"><span>{item.description} × {item.quantity}</span><span>{formatARS(item.total)}</span></li>
                ))}
              </ul>
            </div>
          )}

          {(row.exchangeItems?.length ?? 0) > 0 && (
            <div className="bg-surface border border-border rounded-sm p-5">
              <h2 className="font-semibold mb-3">Ítems entregados (cambio)</h2>
              <ul className="text-[13px] space-y-1">
                {row.exchangeItems!.map((item, i) => (
                  <li key={i} className="flex justify-between"><span>{item.description} × {item.quantity}</span><span>{formatARS(item.total)}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </PageBody>

      <ConfirmDialog
        open={confirmComplete}
        onOpenChange={setConfirmComplete}
        title="Completar devolución"
        description="Se emitirá la nota de crédito (si hay factura) y se actualizará el pedido. ¿Continuar?"
        confirmLabel="Completar"
        onConfirm={() => { setConfirmComplete(false); void runAction('complete', { refund_disposition: 'account_credit' }, 'Devolución completada') }}
      />
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Anular devolución"
        description="¿Anular esta devolución?"
        confirmLabel="Anular"
        variant="danger"
        onConfirm={() => { setConfirmCancel(false); void runAction('cancel', {}, 'Devolución anulada') }}
      />
    </div>
  )
}
