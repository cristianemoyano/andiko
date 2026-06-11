import { useEffect, useMemo, useState } from 'react'

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

export function SalesHistoryScreen({ onResumeDraft }: { onResumeDraft: (draftId: string) => void }) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<SaleRow[]>([])
  const [draftLoading, setDraftLoading] = useState(false)
  const [draftRows, setDraftRows] = useState<DraftRow[]>([])
  const [tab, setTab] = useState<'paid' | 'draft'>('paid')
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [openSaleId, setOpenSaleId] = useState<string | null>(null)
  const [openSale, setOpenSale] = useState<null | Awaited<ReturnType<typeof window.pos.sales.get>>>(null)
  const [openDraftId, setOpenDraftId] = useState<string | null>(null)

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
      return
    }
     
    setError(null)
    window.pos.sales.get(openSaleId).then(setOpenSale).catch(e => {
      setOpenSale(null)
      setError(e instanceof Error ? e.message : String(e))
    })
  }, [openSaleId])

  function handlePrint() {
    document.body.setAttribute('data-printing', '1')
    window.print()
    document.body.removeAttribute('data-printing')
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      r.id.toLowerCase().includes(q) ||
      r.sold_at.toLowerCase().includes(q) ||
      paymentsLabel(r.payments).toLowerCase().includes(q) ||
      r.total.toLowerCase().includes(q)
    )
  }, [rows, query])

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

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="p-4 border-b border-zinc-200 bg-white flex items-center gap-3">
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
        {/* List */}
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
                  <div className="text-[13px] font-medium text-zinc-900 truncate">{s.id}</div>
                  <div className="text-[11px] text-zinc-500">
                    {new Date(s.sold_at).toLocaleString('es-AR')} · {paymentsLabel(s.payments)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-semibold text-zinc-900">
                    ${parseFloat(s.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </div>
                  <div className={`text-[10px] font-medium ${s.synced_at ? 'text-green-700' : 'text-amber-700'}`}>
                    {s.synced_at ? 'synced' : 'pendiente'}
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

        {/* Detail */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'paid' && !openSaleId && (
            <div className="text-[13px] text-zinc-500">Seleccioná una venta para ver el ticket y reimprimir.</div>
          )}

          {tab === 'paid' && openSaleId && openSale === null && (
            <div className="text-[13px] text-zinc-500">Cargando ticket…</div>
          )}

          {tab === 'paid' && openSale && openSale.sale && (
            <div className="max-w-md">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-zinc-800">Ticket</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setOpenSaleId(null)}
                    className="h-9 px-4 bg-white border border-zinc-300 text-[13px] font-medium rounded-md hover:bg-zinc-50 transition-colors"
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={handlePrint}
                    className="h-9 px-4 bg-blue-600 text-white text-[13px] font-semibold rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Imprimir
                  </button>
                </div>
              </div>

              <div id="pos-receipt" className="border border-zinc-200 rounded-lg p-4 bg-white">
                <div className="text-[13px] font-semibold text-zinc-900">Andiko POS</div>
                <div className="text-[11px] text-zinc-500">Venta: {openSale.sale.id}</div>
                <div className="text-[11px] text-zinc-500 mt-1">
                  {new Date(openSale.sale.sold_at).toLocaleString('es-AR')}
                  {' · '}
                  {paymentsLabel(openSale.sale.payments)}
                </div>

                <div className="mt-4 space-y-2">
                  {openSale.items.map(it => (
                    <div key={it.id} className="flex gap-2 text-[12px]">
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-zinc-800">{it.product_name}</div>
                        <div className="text-[11px] text-zinc-500">
                          {it.qty} × ${parseFloat(it.unit_price).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div className="font-medium text-zinc-900">
                        ${parseFloat(it.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-200 space-y-1 text-[12px]">
                  <div className="flex justify-between text-zinc-600">
                    <span>Subtotal</span>
                    <span>${parseFloat(openSale.sale.subtotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>IVA</span>
                    <span>${parseFloat(openSale.sale.tax_amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-zinc-900 text-[13px] pt-1">
                    <span>Total</span>
                    <span>${parseFloat(openSale.sale.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
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

