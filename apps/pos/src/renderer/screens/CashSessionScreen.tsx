import { useState, useEffect, useCallback } from 'react'

interface CashSession {
  id: string
  cashier_user_id: string | null
  cashier_name: string | null
  opened_at: string
  closed_at: string | null
  opening_amount: string
  closing_amount_declared: string | null
  closing_amount_expected: string | null
  difference: string | null
  status: 'open' | 'closed'
}

interface SalesTotals {
  cash: number
  card: number
  transfer: number
  total: number
  count: number
}

const ars = (v: string | number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(Number(v))

function formatDatetime(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: 'red' | 'green' }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-zinc-500 text-sm">{label}</span>
      <span className={`font-mono text-sm font-medium ${
        highlight === 'red' ? 'text-red-600' : highlight === 'green' ? 'text-green-700' : 'text-zinc-900'
      }`}>{value}</span>
    </div>
  )
}

// ── Sales summary fetched from SQLite for a given session ───────────────────

async function fetchSessionTotals(openedAt: string): Promise<SalesTotals> {
  // closingReport queries by date — for session we need all sales since opened_at.
  // We use the full sales list and filter client-side (max 500 sales, fine for POS MVP).
  const all = await window.pos.sales.list({ limit: 500 })
  const openedTs = new Date(openedAt).getTime()
  const sessionSales = all.filter(s => new Date(s.sold_at).getTime() >= openedTs)

  const totals: SalesTotals = { cash: 0, card: 0, transfer: 0, total: 0, count: sessionSales.length }
  for (const s of sessionSales) {
    const amt = Number(s.total)
    if (s.payment_method === 'cash')     totals.cash     += amt
    if (s.payment_method === 'card')     totals.card     += amt
    if (s.payment_method === 'transfer') totals.transfer += amt
    totals.total += amt
  }
  return totals
}

// ── Open Turn ───────────────────────────────────────────────────────────────

function OpenSessionView({ onOpened }: { onOpened: (s: CashSession) => void }) {
  const [amount, setAmount] = useState('0')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleOpen() {
    const val = parseFloat(amount.replace(',', '.'))
    if (isNaN(val) || val < 0) { setError('Ingresá un monto válido'); return }
    setLoading(true)
    setError(null)
    const result = await window.pos.cashSessions.open({ opening_amount: val.toFixed(2) })
    setLoading(false)
    if (result.ok && result.session) {
      onOpened(result.session as CashSession)
    } else {
      setError(result.error ?? 'No se pudo abrir el turno')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-8">
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-8 w-full max-w-sm flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Abrir turno</h2>
            <p className="text-xs text-zinc-500">Ingresá el efectivo disponible al inicio.</p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-600">Efectivo inicial en caja</label>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleOpen()}
            className="border border-zinc-300 rounded-lg px-3 py-2.5 text-lg font-mono text-zinc-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-right"
            autoFocus
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          onClick={handleOpen}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
        >
          {loading ? 'Abriendo…' : 'Abrir turno de caja'}
        </button>
      </div>
    </div>
  )
}

// ── Active Turn ─────────────────────────────────────────────────────────────

function ActiveSessionView({ session, onClosed }: { session: CashSession; onClosed: (s: CashSession) => void }) {
  const [totals, setTotals] = useState<SalesTotals | null>(null)
  const [declaredAmount, setDeclaredAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [closingResult, setClosingResult] = useState<CashSession | null>(null)

   
  useEffect(() => {
    fetchSessionTotals(session.opened_at).then(setTotals).catch(() => setTotals({ cash: 0, card: 0, transfer: 0, total: 0, count: 0 }))
  }, [session.opened_at])

  async function handleClose() {
    const val = parseFloat(declaredAmount.replace(',', '.'))
    if (isNaN(val) || val < 0) { setError('Ingresá un monto válido'); return }
    setLoading(true)
    setError(null)
    const result = await window.pos.cashSessions.close({
      session_id: session.id,
      closing_amount_declared: val.toFixed(2),
    })
    setLoading(false)
    if (result.ok && result.session) {
      setClosingResult(result.session as CashSession)
      onClosed(result.session as CashSession)
    } else {
      setError(result.error ?? 'No se pudo cerrar el turno')
    }
  }

  // ── Post-close summary ──────────────────────────────────────────────────

  if (closingResult) {
    const diff = Number(closingResult.difference ?? 0)
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-8">
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-8 w-full max-w-md flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Turno cerrado</h2>
              <p className="text-xs text-zinc-500">{formatDatetime(session.opened_at)} → {closingResult.closed_at ? formatDatetime(closingResult.closed_at) : ''}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <Row label="Efectivo inicial" value={ars(closingResult.opening_amount)} />
            <Row label="Ventas en efectivo" value={ars(totals?.cash ?? 0)} />
            <div className="border-t border-zinc-100 pt-2.5 mt-0.5">
              <Row label="Esperado en caja" value={ars(closingResult.closing_amount_expected ?? 0)} />
              <Row label="Contado físico" value={ars(closingResult.closing_amount_declared ?? 0)} />
            </div>
            <div className="border-t border-zinc-100 pt-2.5 mt-0.5">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-zinc-700">Diferencia</span>
                <span className={`font-mono text-base font-bold ${diff === 0 ? 'text-zinc-600' : diff > 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {diff >= 0 ? '+' : ''}{ars(diff)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-zinc-50 rounded-lg px-4 py-3 flex justify-between items-center">
            <div>
              <p className="text-[11px] text-zinc-400 uppercase tracking-wide font-medium">Total ventas del turno</p>
              <p className="text-xs text-zinc-500 mt-0.5">{totals?.count ?? 0} venta{totals?.count !== 1 ? 's' : ''}</p>
            </div>
            <p className="font-mono text-lg font-bold text-zinc-900">{ars(totals?.total ?? 0)}</p>
          </div>

          <p className="text-[11px] text-zinc-400 text-center">
            El turno se sincronizará al cloud automáticamente.
          </p>
        </div>
      </div>
    )
  }

  // ── Active turn panel ───────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-5 p-6 max-w-xl mx-auto w-full">

      {/* Session info */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-green-700 uppercase tracking-wide">Turno abierto</span>
          <span className="text-[11px] text-zinc-400">{formatDatetime(session.opened_at)}</span>
        </div>
        {session.cashier_name && (
          <p className="text-sm text-zinc-700 mt-1">Cajero: <span className="font-medium">{session.cashier_name}</span></p>
        )}
        <Row label="Efectivo inicial" value={ars(session.opening_amount)} />
      </div>

      {/* Sales of this session */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5 flex flex-col gap-3">
        <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Ventas del turno</p>
        {totals === null ? (
          <p className="text-sm text-zinc-400">Cargando…</p>
        ) : (
          <>
            <Row label="Efectivo" value={ars(totals.cash)} />
            <Row label="Tarjeta / débito" value={ars(totals.card)} />
            <Row label="Transferencia" value={ars(totals.transfer)} />
            <div className="border-t border-zinc-100 pt-3 flex justify-between items-center">
              <span className="text-sm font-semibold text-zinc-700">Total vendido</span>
              <span className="font-mono text-base font-bold text-zinc-900">{ars(totals.total)}</span>
            </div>
            <p className="text-[11px] text-zinc-400">{totals.count} venta{totals.count !== 1 ? 's' : ''} desde la apertura</p>
          </>
        )}
      </div>

      {/* Close session */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5 flex flex-col gap-3">
        <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Cerrar turno</p>
        <p className="text-xs text-zinc-500">
          Contá el efectivo físico en caja. El sistema calcula la diferencia automáticamente.
        </p>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-600">Efectivo contado en caja</label>
          <input
            type="text"
            inputMode="decimal"
            value={declaredAmount}
            onChange={e => setDeclaredAmount(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleClose()}
            placeholder="0,00"
            className="border border-zinc-300 rounded-lg px-3 py-2.5 text-lg font-mono text-zinc-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-right"
          />
        </div>
        {declaredAmount !== '' && !isNaN(parseFloat(declaredAmount.replace(',', '.'))) && totals !== null && (
          <div className="bg-zinc-50 rounded-lg px-4 py-2.5 flex justify-between items-center">
            <span className="text-xs text-zinc-500">
              Esperado: <span className="font-mono font-medium text-zinc-700">
                {ars(Number(session.opening_amount) + totals.cash)}
              </span>
            </span>
            {(() => {
              const declared = parseFloat(declaredAmount.replace(',', '.'))
              const expected = Number(session.opening_amount) + totals.cash
              const diff = declared - expected
              return (
                <span className={`text-xs font-mono font-semibold ${diff === 0 ? 'text-zinc-600' : diff > 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {diff >= 0 ? '+' : ''}{ars(diff)}
                </span>
              )
            })()}
          </div>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          onClick={handleClose}
          disabled={loading || !declaredAmount}
          className="bg-zinc-900 hover:bg-zinc-700 text-white font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-40"
        >
          {loading ? 'Cerrando…' : 'Cerrar turno de caja'}
        </button>
      </div>
    </div>
  )
}

// ── History ──────────────────────────────────────────────────────────────────

function SessionHistory({ sessions }: { sessions: CashSession[] }) {
  if (sessions.length === 0) return null
  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden max-w-xl mx-auto w-full">
      <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide px-5 py-3 border-b border-zinc-100">Historial de turnos</p>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-zinc-50 border-b border-zinc-100">
            {['Apertura', 'Cajero', 'Ventas', 'Diferencia', 'Estado'].map(h => (
              <th key={h} className="text-[10px] font-semibold text-zinc-400 px-4 py-2 text-left uppercase">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sessions.map(s => {
            const diff = s.difference !== null ? Number(s.difference) : null
            return (
              <tr key={s.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                <td className="font-mono text-[11px] px-4 py-2 text-zinc-600">{formatDatetime(s.opened_at)}</td>
                <td className="text-[12px] px-4 py-2 text-zinc-700">{s.cashier_name ?? '—'}</td>
                <td className="font-mono text-[11px] px-4 py-2 text-zinc-600">{s.closing_amount_expected ? ars(s.closing_amount_expected) : '—'}</td>
                <td className={`font-mono text-[11px] px-4 py-2 font-medium ${diff === null ? 'text-zinc-400' : diff === 0 ? 'text-zinc-600' : diff > 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {diff === null ? '—' : `${diff >= 0 ? '+' : ''}${ars(diff)}`}
                </td>
                <td className="px-4 py-2">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${s.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                    {s.status === 'open' ? 'Abierto' : 'Cerrado'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export function CashSessionScreen() {
  const [session, setSession] = useState<CashSession | null | undefined>(undefined)
  const [history, setHistory] = useState<CashSession[]>([])
  const [showHistory, setShowHistory] = useState(false)

  const loadSession = useCallback(async () => {
    const [current, all] = await Promise.all([
      window.pos.cashSessions.getCurrent(),
      window.pos.cashSessions.list({ limit: 10 }),
    ])
    setSession(current)
    setHistory((all as CashSession[]).filter(s => s.status === 'closed').slice(0, 10))
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch on mount
  useEffect(() => { loadSession() }, [loadSession])

  if (session === undefined) {
    return <div className="flex items-center justify-center h-full text-zinc-400 text-sm">Cargando…</div>
  }

  return (
    <div className="flex flex-col h-full bg-zinc-50">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-[15px] font-semibold text-zinc-900">Turno de caja</h1>
          {session && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">Abierto</span>
          )}
        </div>
        {history.length > 0 && (
          <button
            onClick={() => setShowHistory(v => !v)}
            className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            {showHistory ? 'Ocultar historial' : 'Ver historial'}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto py-6 flex flex-col gap-5">
        {session ? (
          <ActiveSessionView
            session={session}
            onClosed={() => { setSession(null); setShowHistory(true); loadSession() }}
          />
        ) : (
          <OpenSessionView onOpened={s => { setSession(s); setShowHistory(false) }} />
        )}

        {showHistory && history.length > 0 && (
          <div className="px-6 pb-2">
            <SessionHistory sessions={history} />
          </div>
        )}
      </div>
    </div>
  )
}
