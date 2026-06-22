import { useState, useEffect, useCallback } from 'react'
import { CashierListFiltersNote } from '../components/CashierListFiltersNote'
import { CurrencyInput } from '../components/CurrencyInput'

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
  cloud_id: string | null
  synced_at: string | null
}

interface SalesTotals {
  byType: Record<string, number>
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
  const all = await window.pos.sales.list({ limit: 500 })
  const openedTs = new Date(openedAt).getTime()
  const sessionSales = all.filter(s => new Date(s.sold_at).getTime() >= openedTs)

  const byType: Record<string, number> = {}
  let total = 0
  for (const s of sessionSales) {
    try {
      const payments: Array<{ payment_method_name: string; amount: string }> = JSON.parse(s.payments ?? '[]')
      for (const p of payments) {
        byType[p.payment_method_name] = (byType[p.payment_method_name] ?? 0) + Number(p.amount)
      }
    } catch { /* ignore malformed rows */ }
    total += Number(s.total)
  }
  return { byType, total, count: sessionSales.length }
}

// ── Open Turn ───────────────────────────────────────────────────────────────

interface PosUser { id: string; name: string; email: string; role: string; role_label: string }

function OpenSessionView({ onOpened, usersRefreshKey }: { onOpened: (s: CashSession) => void; usersRefreshKey: number }) {
  const [users, setUsers] = useState<PosUser[]>([])
  const [search, setSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [amount, setAmount] = useState('0.00')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.pos.users.search('').then(r => {
      if (r.ok) setUsers(r.data)
    }).catch(() => {})
  }, [usersRefreshKey])

  const filteredUsers = search.trim()
    ? users.filter(u => {
        const q = search.toLowerCase()
        return u.name.toLowerCase().includes(q)
          || u.email.toLowerCase().includes(q)
          || u.role_label.toLowerCase().includes(q)
      })
    : users

  async function handleOpen() {
    if (!selectedUserId) { setError('Seleccioná un cajero para abrir el turno'); return }
    const val = parseFloat(amount)
    if (isNaN(val) || val < 0) { setError('Ingresá un monto inicial válido'); return }
    if (!pin.trim()) { setError('Ingresá el PIN del cajero'); return }

    setLoading(true)
    setError(null)

    const pinResult = await window.pos.users.verifyPin({ user_id: selectedUserId, pin: pin.trim() })
    if (!pinResult.ok) {
      setLoading(false)
      setPin('')
      setError(pinResult.error ?? 'PIN incorrecto')
      return
    }

    const cashier = users.find(u => u.id === selectedUserId)
    const result = await window.pos.cashSessions.open({
      cashier_user_id: selectedUserId,
      cashier_name: cashier?.name ?? null,
      opening_amount: val.toFixed(2),
    })
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
            <p className="text-xs text-zinc-500">Elegí el cajero y el efectivo inicial.</p>
          </div>
        </div>

        <CashierListFiltersNote />

        {/* Cashier selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-600">Cajero</label>
          {users.length === 0 ? (
            <p className="text-xs text-zinc-400 py-2">Sin usuarios sincronizados. Sincronizá el catálogo primero.</p>
          ) : (
            <>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre, email o rol…"
                className="border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                autoFocus
              />
            <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto">
              {filteredUsers.length === 0 && (
                <p className="text-xs text-zinc-400 py-2 text-center">Sin resultados</p>
              )}
              {filteredUsers.map(u => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedUserId(u.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                    selectedUserId === u.id
                      ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                      : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-zinc-200 flex items-center justify-center shrink-0 text-[11px] font-semibold text-zinc-600">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">{u.name}</p>
                    <p className="text-[11px] text-zinc-500 truncate">
                      {u.role_label} - {u.email}
                    </p>
                  </div>
                  {selectedUserId === u.id && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand-600 shrink-0">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
            </>
          )}
        </div>

        {/* Opening amount */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-600">Efectivo inicial en caja</label>
          <CurrencyInput
            value={amount}
            onChange={setAmount}
            onKeyDown={e => e.key === 'Enter' && handleOpen()}
            className="border border-zinc-300 rounded-lg px-3 py-2.5 text-lg font-mono text-zinc-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-right w-full"
          />
        </div>

        {/* PIN */}
        {selectedUserId && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-600">PIN del cajero</label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleOpen()}
              placeholder="••••"
              className="border border-zinc-300 rounded-lg px-3 py-2.5 text-lg font-mono text-zinc-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-center tracking-widest"
            />
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          onClick={handleOpen}
          disabled={loading || !selectedUserId}
          className="bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-40"
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
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [closingResult, setClosingResult] = useState<CashSession | null>(null)

   
  useEffect(() => {
    fetchSessionTotals(session.opened_at).then(setTotals).catch(() => setTotals({ cash: 0, card: 0, transfer: 0, total: 0, count: 0 }))
  }, [session.opened_at])

  async function handleClose() {
    const val = parseFloat(declaredAmount)
    if (isNaN(val) || val < 0) { setError('Ingresá un monto válido'); return }
    if (!pin.trim()) { setError('Ingresá el PIN del cajero para cerrar el turno'); return }

    setLoading(true)
    setError(null)

    if (session.cashier_user_id) {
      const pinResult = await window.pos.users.verifyPin({ user_id: session.cashier_user_id, pin: pin.trim() })
      if (!pinResult.ok) {
        setLoading(false)
        setPin('')
        setError(pinResult.error ?? 'PIN incorrecto')
        return
      }
    }

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
            {Object.entries(totals.byType).map(([name, amount]) => (
              <Row key={name} label={name} value={ars(amount)} />
            ))}
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
          <CurrencyInput
            value={declaredAmount}
            onChange={setDeclaredAmount}
            onKeyDown={e => e.key === 'Enter' && handleClose()}
            placeholder="$ 0,00"
            className="border border-zinc-300 rounded-lg px-3 py-2.5 text-lg font-mono text-zinc-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-right w-full"
          />
        </div>
        {declaredAmount !== '' && !isNaN(parseFloat(declaredAmount)) && totals !== null && (
          <div className="bg-zinc-50 rounded-lg px-4 py-2.5 flex justify-between items-center">
            <span className="text-xs text-zinc-500">
              Esperado: <span className="font-mono font-medium text-zinc-700">
                {ars(Number(session.opening_amount) + (totals.byType['Efectivo'] ?? totals.byType['cash'] ?? 0))}
              </span>
            </span>
            {(() => {
              const declared = parseFloat(declaredAmount)
              const expected = Number(session.opening_amount) + (totals.byType['Efectivo'] ?? totals.byType['cash'] ?? 0)
              const diff = declared - expected
              return (
                <span className={`text-xs font-mono font-semibold ${diff === 0 ? 'text-zinc-600' : diff > 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {diff >= 0 ? '+' : ''}{ars(diff)}
                </span>
              )
            })()}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-600">PIN del cajero</label>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={e => setPin(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleClose()}
            placeholder="••••"
            className="border border-zinc-300 rounded-lg px-3 py-2.5 text-lg font-mono text-zinc-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-center tracking-widest"
          />
        </div>

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
            {['Apertura', 'Cajero', 'Ventas', 'Diferencia', 'Estado', 'Sync'].map(h => (
              <th key={h} className="text-[10px] font-semibold text-zinc-400 px-4 py-2 text-left uppercase">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sessions.map(s => {
            const diff = s.difference !== null ? Number(s.difference) : null
            const synced = !!s.synced_at
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
                <td className="px-4 py-2">
                  <span className={`text-[10px] font-medium ${synced ? 'text-green-700' : 'text-amber-600'}`}>
                    {synced ? 'synced' : 'pendiente'}
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
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [usersRefreshKey, setUsersRefreshKey] = useState(0)

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

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    const catalog = await window.pos.sync.catalog()
    if (!catalog.ok) {
      setSyncing(false)
      setSyncMsg({ ok: false, text: catalog.error ?? 'Error al sincronizar datos' })
      setTimeout(() => setSyncMsg(null), 5000)
      return
    }
    const result = await window.pos.sync.sales()
    setSyncing(false)
    setSyncMsg(result.ok ? { ok: true, text: 'Datos y ventas sincronizados' } : { ok: false, text: result.error ?? 'Error al sincronizar ventas' })
    setUsersRefreshKey(k => k + 1)
    loadSession()
    setTimeout(() => setSyncMsg(null), 5000)
  }

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
        <div className="flex items-center gap-3">
          {syncMsg && (
            <span className={`text-[11px] font-medium ${syncMsg.ok ? 'text-green-700' : 'text-red-600'}`}>
              {syncMsg.text}
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300 transition-colors disabled:opacity-40"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={syncing ? 'animate-spin' : ''}>
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            {syncing ? 'Sincronizando…' : 'Sync cloud'}
          </button>
          {history.length > 0 && (
            <button
              onClick={() => setShowHistory(v => !v)}
              className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              {showHistory ? 'Ocultar historial' : 'Ver historial'}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto py-6 flex flex-col gap-5">
        {session ? (
          <ActiveSessionView
            session={session}
            onClosed={() => { setSession(null); setShowHistory(true); loadSession() }}
          />
        ) : (
          <OpenSessionView
            usersRefreshKey={usersRefreshKey}
            onOpened={s => { setSession(s); setShowHistory(false) }}
          />
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
