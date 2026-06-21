import { useEffect, useMemo, useState } from 'react'
import type { PosCustomer, PosSalePayment } from '@andiko/shared'
import { PosReceipt } from '../components/PosReceipt'
import { usePosFiscalProfile } from '../lib/usePosFiscalProfile'
import { printPosReceipt } from '../lib/print-receipt'

type SaleRow = Awaited<ReturnType<typeof window.pos.sales.list>>[number]
type DraftRow = Awaited<ReturnType<typeof window.pos.draftSales.list>>['data'][number]

function paymentsLabel(paymentsJson: string | null): string {
  try {
    const payments: Array<{ payment_method_name: string }> = JSON.parse(paymentsJson ?? '[]')
    if (payments.length === 0) return '—'
    return payments.map(p => p.payment_method_name).join(' + ')
  } catch {
    return '—'
  }
}

function saleNeedsFiscal(s: SaleRow): boolean {
  return !s.cae || s.afip_status === 'pending' || s.afip_status === 'contingency'
}

export function SalesHistoryScreen({ onResumeDraft }: { onResumeDraft: (draftId: string) => void }) {
  const fiscal = usePosFiscalProfile()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<SaleRow[]>([])
  const [draftLoading, setDraftLoading] = useState(false)
  const [draftRows, setDraftRows] = useState<DraftRow[]>([])
  const [tab, setTab] = useState<'paid' | 'draft'>('paid')
  const [paidFilter, setPaidFilter] = useState<'all' | 'no_cae'>('all')
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [openSaleId, setOpenSaleId] = useState<string | null>(null)
  const [openSale, setOpenSale] = useState<null | Awaited<ReturnType<typeof window.pos.sales.get>>>(null)
  const [openSaleCustomer, setOpenSaleCustomer] = useState<PosCustomer | null>(null)
  const [openDraftId, setOpenDraftId] = useState<string | null>(null)
  const [authorizing, setAuthorizing] = useState(false)
  const [authorizeError, setAuthorizeError] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const r = await window.pos.sales.list({ limit: 250 })
      setRows(r)
    } catch (e) {
      setRows([])
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function refreshDrafts() {
    setDraftLoading(true)
    setError(null)
    try {
      const r = await window.pos.draftSales.list({ status: 'draft', limit: 250 })
      setDraftRows(r.data)
    } catch (e) {
      setDraftRows([])
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setDraftLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refresh triggers async DB read then setState
    refresh()
  }, [])

  useEffect(() => {
    if (!openSaleId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on deselect is a valid derived-state pattern
      setOpenSale(null)
      setOpenSaleCustomer(null)
      setAuthorizeError(null)
      return
    }

    setError(null)
    window.pos.sales.get(openSaleId).then(async (sale) => {
      setOpenSale(sale)
      if (sale?.sale.customer_id) {
        const c = await window.pos.customers.get(sale.sale.customer_id)
        setOpenSaleCustomer(c)
      } else {
        setOpenSaleCustomer(null)
      }
    }).catch(e => {
      setOpenSale(null)
      setOpenSaleCustomer(null)
      setError(e instanceof Error ? e.message : String(e))
    })
  }, [openSaleId])

  async function handlePrint() {
    await printPosReceipt()
  }

  async function handleAuthorizeFiscal() {
    if (!openSaleId) return
    setAuthorizing(true)
    setAuthorizeError(null)
    try {
      const result = await window.pos.sales.authorizeFiscal(openSaleId)
      if (result.fiscal_pending) {
        setAuthorizeError('AFIP no autorizó el comprobante. Reintentá más tarde.')
        return
      }
      const sale = await window.pos.sales.get(openSaleId)
      setOpenSale(sale)
      await refresh()
    } catch (e) {
      setAuthorizeError(e instanceof Error ? e.message : String(e))
    } finally {
      setAuthorizing(false)
    }
  }

  const filtered = useMemo(() => {
    let list = rows
    if (paidFilter === 'no_cae') {
      list = list.filter(saleNeedsFiscal)
    }
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter(r =>
      r.id.toLowerCase().includes(q) ||
      r.sold_at.toLowerCase().includes(q) ||
      paymentsLabel(r.payments).toLowerCase().includes(q) ||
      r.total.toLowerCase().includes(q) ||
      (r.ticket_number ?? '').toLowerCase().includes(q),
    )
  }, [rows, query, paidFilter])

  const filteredDrafts = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return draftRows
    return draftRows.filter((r) =>
      r.id.toLowerCase().includes(q) ||
      (r.updated_at ?? '').toLowerCase().includes(q) ||
      (r.cashier_name ?? '').toLowerCase().includes(q) ||
      (r.total ?? '').toLowerCase().includes(q),
    )
  }, [draftRows, query])

  const openSaleNeedsFiscal = openSale?.sale ? saleNeedsFiscal(openSale.sale as SaleRow) : false

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="p-4 border-b border-zinc-200 bg-white flex items-center gap-3 flex-wrap">
        <div className="text-sm font-semibold text-zinc-800">Ventas</div>
        <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-1">
          <button
            onClick={() => { setTab('paid'); setOpenDraftId(null) }}
            className={`h-8 px-3 rounded-md text-[12px] font-medium ${tab === 'paid' ? 'bg-white shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}
          >
            Cobradas
          </button>
          <button
            onClick={() => { setTab('draft'); setOpenSaleId(null); if (draftRows.length === 0) void refreshDrafts() }}
            className={`h-8 px-3 rounded-md text-[12px] font-medium ${tab === 'draft' ? 'bg-white shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}
          >
            Borradores
          </button>
        </div>
        {tab === 'paid' && (
          <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-1">
            <button
              onClick={() => setPaidFilter('all')}
              className={`h-8 px-3 rounded-md text-[12px] font-medium ${paidFilter === 'all' ? 'bg-white shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}
            >
              Todas
            </button>
            <button
              onClick={() => setPaidFilter('no_cae')}
              className={`h-8 px-3 rounded-md text-[12px] font-medium ${paidFilter === 'no_cae' ? 'bg-white shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}
            >
              Sin CAE
            </button>
          </div>
        )}
        <div className="flex-1" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={tab === 'paid' ? 'Buscar por ID, fecha, medio de pago o total…' : 'Buscar por ID, cajero/a o total…'}
          className="w-80 h-9 px-3 text-[13px] border border-zinc-300 rounded-md bg-white focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={tab === 'paid' ? refresh : refreshDrafts}
          className="h-9 px-4 bg-white border border-zinc-300 text-[13px] font-medium rounded-md hover:bg-zinc-50 transition-colors"
        >
          Recargar
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex">
        <div className="w-[420px] border-r border-zinc-200 bg-white overflow-y-auto">
          {error && (
            <div className="p-4 text-[12px] text-red-700 bg-red-50 border-b border-red-200">
              Error cargando ventas: {error}
            </div>
          )}
          {tab === 'paid' && loading && (
            <div className="p-4 text-[13px] text-zinc-500">Cargando ventas…</div>
          )}
          {tab === 'paid' && !loading && filtered.length === 0 && (
            <div className="p-4 text-[13px] text-zinc-500">Sin ventas para mostrar.</div>
          )}
          {tab === 'paid' && !loading && filtered.map(s => (
            <button
              key={s.id}
              onClick={() => setOpenSaleId(s.id)}
              className={`w-full text-left px-4 py-3 border-b border-zinc-100 hover:bg-zinc-50 transition-colors ${
                openSaleId === s.id ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-zinc-900 truncate">
                    {s.ticket_number ?? s.id.slice(0, 8).toUpperCase()}
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {new Date(s.sold_at).toLocaleString('es-AR')} · {paymentsLabel(s.payments)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-semibold text-zinc-900">
                    ${parseFloat(s.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </div>
                  <div className={`text-[10px] font-medium ${saleNeedsFiscal(s) ? 'text-amber-700' : 'text-green-700'}`}>
                    {saleNeedsFiscal(s) ? 'sin CAE' : 'fiscal OK'}
                  </div>
                </div>
              </div>
            </button>
          ))}

          {tab === 'draft' && draftLoading && (
            <div className="p-4 text-[13px] text-zinc-500">Cargando borradores…</div>
          )}
          {tab === 'draft' && !draftLoading && filteredDrafts.length === 0 && (
            <div className="p-4 text-[13px] text-zinc-500">Sin borradores para mostrar.</div>
          )}
          {tab === 'draft' && !draftLoading && filteredDrafts.map((d) => (
            <button
              key={d.id}
              onClick={() => setOpenDraftId(d.id)}
              className={`w-full text-left px-4 py-3 border-b border-zinc-100 hover:bg-zinc-50 transition-colors ${
                openDraftId === d.id ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-zinc-900 truncate">{d.id}</div>
                  <div className="text-[11px] text-zinc-500">
                    {new Date(d.updated_at).toLocaleString('es-AR')}
                    {d.cashier_name ? ` · ${d.cashier_name}` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-semibold text-zinc-900">
                    ${parseFloat(d.total ?? '0').toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] font-medium text-amber-700">
                    borrador
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'paid' && !openSaleId && (
            <div className="text-[13px] text-zinc-500">Seleccioná una venta para ver el ticket y reimprimir.</div>
          )}

          {tab === 'paid' && openSaleId && openSale === null && (
            <div className="text-[13px] text-zinc-500">Cargando ticket…</div>
          )}

          {tab === 'paid' && openSale && openSale.sale && (
            <div className="flex flex-col max-w-md max-h-full">
              <div className="shrink-0 flex items-center justify-between mb-3 print:hidden">
                <div className="text-sm font-semibold text-zinc-800">Ticket</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setOpenSaleId(null)}
                    className="h-9 px-4 bg-white border border-zinc-300 text-[13px] font-medium rounded-md hover:bg-zinc-50 transition-colors"
                  >
                    Cerrar
                  </button>
                  {openSaleNeedsFiscal && (
                    <button
                      onClick={() => void handleAuthorizeFiscal()}
                      disabled={authorizing}
                      className="h-9 px-4 bg-amber-600 text-white text-[13px] font-semibold rounded-md hover:bg-amber-700 disabled:opacity-50 transition-colors"
                    >
                      {authorizing ? 'Autorizando…' : 'Autorizar AFIP'}
                    </button>
                  )}
                  <button
                    onClick={handlePrint}
                    className="h-9 px-4 bg-blue-600 text-white text-[13px] font-semibold rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Imprimir
                  </button>
                </div>
              </div>

              {authorizeError && (
                <div className="shrink-0 mb-3 print:hidden text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {authorizeError}
                </div>
              )}

              <div className="flex-1 min-h-0 overflow-y-auto">
                <PosReceipt
                  ticketNumber={openSale.sale.ticket_number ?? openSale.sale.id.slice(0, 8).toUpperCase()}
                  soldAt={openSale.sale.sold_at}
                  items={openSale.items.map((it) => ({
                    product_name: it.product_name,
                    qty: it.qty,
                    unit_price: it.unit_price,
                    iva_rate: it.iva_rate,
                    total: it.total,
                  }))}
                  subtotal={openSale.sale.subtotal}
                  taxAmount={openSale.sale.tax_amount}
                  total={openSale.sale.total}
                  payments={JSON.parse(openSale.sale.payments ?? '[]') as PosSalePayment[]}
                  customer={openSaleCustomer ? {
                    legal_name: openSaleCustomer.legal_name,
                    trade_name: openSaleCustomer.trade_name,
                    cuit: openSaleCustomer.cuit,
                    iva_condition: openSaleCustomer.iva_condition ?? null,
                  } : null}
                  fiscal={fiscal}
                  cashierName={openSale.sale.cashier_name}
                  cae={openSale.sale.cae}
                  caeExpiration={openSale.sale.cae_expiration}
                  qrUrl={openSale.sale.qr_url}
                  fiscalPending={openSaleNeedsFiscal}
                />
              </div>
            </div>
          )}

          {tab === 'paid' && openSaleId && openSale && openSale.sale === undefined && (
            <div className="text-[13px] text-zinc-500">Venta no encontrada.</div>
          )}

          {tab === 'draft' && !openDraftId && (
            <div className="text-[13px] text-zinc-500">Seleccioná un borrador para reanudar la venta.</div>
          )}
          {tab === 'draft' && openDraftId && (
            <div className="max-w-md space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-zinc-800">Borrador</div>
                  <div className="text-[11px] text-zinc-500">{openDraftId}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setOpenDraftId(null)}
                    className="h-9 px-4 bg-white border border-zinc-300 text-[13px] font-medium rounded-md hover:bg-zinc-50 transition-colors"
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={() => onResumeDraft(openDraftId)}
                    className="h-9 px-4 bg-blue-600 text-white text-[13px] font-semibold rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Reanudar
                  </button>
                </div>
              </div>
              <div className="text-[12px] text-zinc-600">
                Última edición: {draftRows.find(r => r.id === openDraftId)?.updated_at ? new Date(draftRows.find(r => r.id === openDraftId)!.updated_at).toLocaleString('es-AR') : '—'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
