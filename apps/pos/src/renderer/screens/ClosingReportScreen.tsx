import { useState, useEffect, useCallback } from 'react'

type Report = {
  cash: number
  card: number
  transfer: number
  total: number
  count: number
  date: string
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function ClosingReportScreen() {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))

  const load = useCallback(async () => {
    setLoading(true)
    const r = await window.pos.sales.closingReport(date)
    setReport(r)
    setLoading(false)
  }, [date])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() is async, setState runs after await
  useEffect(() => { load() }, [load])

  const rows = report ? [
    { label: 'Efectivo',       amount: report.cash,     icon: '💵' },
    { label: 'Tarjeta',        amount: report.card,     icon: '💳' },
    { label: 'Transferencia',  amount: report.transfer, icon: '🏦' },
  ] : []

  return (
    <div className="flex flex-col h-full bg-zinc-100">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Cierre de caja</h1>
          <p className="text-sm text-zinc-500">Resumen de ventas del día</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="text-sm border border-zinc-300 rounded-lg px-3 py-1.5 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-1.5 bg-zinc-900 text-white text-sm rounded-lg hover:bg-zinc-700 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
            </svg>
            Imprimir
          </button>
        </div>
      </div>

      {/* Print header — solo visible al imprimir */}
      <div className="hidden print:block px-8 py-6 border-b border-zinc-300">
        <h1 className="text-2xl font-bold">Cierre de caja</h1>
        <p className="text-zinc-600">{report ? formatDate(report.date) : ''}</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-zinc-400 text-sm">Cargando...</div>
        ) : report ? (
          <div className="max-w-lg mx-auto space-y-4">
            {/* Totales por método */}
            <div className="bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-100">
              {rows.map(row => (
                <div key={row.label} className="flex items-center justify-between px-5 py-4">
                  <span className="text-sm font-medium text-zinc-700">{row.label}</span>
                  <span className={`text-sm font-semibold ${row.amount > 0 ? 'text-zinc-900' : 'text-zinc-400'}`}>
                    {fmt(row.amount)}
                  </span>
                </div>
              ))}
            </div>

            {/* Total general */}
            <div className="bg-zinc-900 rounded-xl px-5 py-5 flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide">Total del día</p>
                <p className="text-zinc-300 text-sm mt-0.5">{report.count} {report.count === 1 ? 'venta' : 'ventas'}</p>
              </div>
              <p className="text-white text-2xl font-bold">{fmt(report.total)}</p>
            </div>

            {/* Fecha */}
            <p className="text-center text-xs text-zinc-400 print:hidden">
              {formatDate(report.date)}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
