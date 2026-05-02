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

const ars = (v: string | number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(Number(v))

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ── Open Turn Form ──────────────────────────────────────────────────────────

function OpenSessionForm({ onOpened }: { onOpened: (s: CashSession) => void }) {
  const [amount, setAmount] = useState('')
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
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
      <div className="bg-white rounded-lg border border-zinc-200 shadow p-8 w-full max-w-sm flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Abrir turno de caja</h2>
          <p className="text-sm text-zinc-500 mt-1">Ingresá el efectivo disponible al inicio del turno.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-600">Efectivo inicial</label>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleOpen()}
            placeholder="0,00"
            className="border border-zinc-300 rounded-md px-3 py-2.5 text-base font-mono text-zinc-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            autoFocus
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={handleOpen}
          disabled={loading}
          className="bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-md py-2.5 text-sm transition-colors disabled:opacity-50"
        >
          {loading ? 'Abriendo…' : 'Abrir turno'}
        </button>
      </div>
    </div>
  )
}

// ── Close Turn Form ─────────────────────────────────────────────────────────

function CloseSessionForm({ session, onClosed }: { session: CashSession; onClosed: (s: CashSession) => void }) {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [closingResult, setClosingResult] = useState<CashSession | null>(null)

  async function handleClose() {
    const val = parseFloat(amount.replace(',', '.'))
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

  if (closingResult) {
    const diff = Number(closingResult.difference ?? 0)
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
        <div className="bg-white rounded-lg border border-zinc-200 shadow p-8 w-full max-w-sm flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <h2 className="text-lg font-semibold text-zinc-900">Turno cerrado</h2>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <Row label="Apertura" value={ars(closingResult.opening_amount)} />
            <Row label="Efectivo esperado" value={ars(closingResult.closing_amount_expected ?? 0)} />
            <Row label="Efectivo declarado" value={ars(closingResult.closing_amount_declared ?? 0)} />
            <div className={`flex justify-between font-semibold ${diff === 0 ? 'text-zinc-900' : diff > 0 ? 'text-green-700' : 'text-red-600'}`}>
              <span>Diferencia</span>
              <span>{diff >= 0 ? '+' : ''}{ars(diff)}</span>
            </div>
          </div>
          <p className="text-xs text-zinc-400 mt-1">Este resumen se sincronizará al cloud en el próximo ciclo de sync.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
      <div className="bg-white rounded-lg border border-zinc-200 shadow p-8 w-full max-w-sm flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Cerrar turno de caja</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Turno abierto el {formatTime(session.opened_at)}
            {session.cashier_name && ` por ${session.cashier_name}`}.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-sm text-zinc-700">
          <Row label="Efectivo inicial" value={ars(session.opening_amount)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-600">Efectivo en caja (contado físico)</label>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleClose()}
            placeholder="0,00"
            className="border border-zinc-300 rounded-md px-3 py-2.5 text-base font-mono text-zinc-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            autoFocus
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={handleClose}
          disabled={loading}
          className="bg-red-600 hover:bg-red-700 text-white font-medium rounded-md py-2.5 text-sm transition-colors disabled:opacity-50"
        >
          {loading ? 'Cerrando…' : 'Cerrar turno'}
        </button>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  )
}

// ── History Panel ───────────────────────────────────────────────────────────

function SessionHistory() {
  const [sessions, setSessions] = useState<CashSession[]>([])

  useEffect(() => {
     
    window.pos.cashSessions.list({ limit: 20 }).then(setSessions).catch(() => {})
  }, [])

  if (sessions.length === 0) return null

  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow overflow-hidden w-full max-w-2xl mx-auto">
      <div className="px-4 py-3 border-b border-zinc-100 text-sm font-semibold text-zinc-700">Historial de turnos</div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-zinc-50">
            {['Apertura', 'Cierre', 'Cajero', 'Esperado', 'Declarado', 'Diferencia', 'Estado'].map(h => (
              <th key={h} className="text-[11px] font-semibold text-zinc-400 px-3 py-2 border-b border-zinc-100 uppercase text-left">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sessions.map(s => {
            const diff = s.difference ? Number(s.difference) : null
            return (
              <tr key={s.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                <td className="font-mono text-[12px] px-3 py-2 text-zinc-600">{formatTime(s.opened_at)}</td>
                <td className="font-mono text-[12px] px-3 py-2 text-zinc-600">{s.closed_at ? formatTime(s.closed_at) : '—'}</td>
                <td className="text-[12px] px-3 py-2 text-zinc-700">{s.cashier_name ?? '—'}</td>
                <td className="font-mono text-[12px] px-3 py-2">{s.closing_amount_expected ? ars(s.closing_amount_expected) : '—'}</td>
                <td className="font-mono text-[12px] px-3 py-2">{s.closing_amount_declared ? ars(s.closing_amount_declared) : '—'}</td>
                <td className={`font-mono text-[12px] px-3 py-2 font-medium ${diff === null ? '' : diff === 0 ? 'text-zinc-600' : diff > 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {diff === null ? '—' : `${diff >= 0 ? '+' : ''}${ars(diff)}`}
                </td>
                <td className="px-3 py-2">
                  <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${s.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
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

// ── Main Screen ─────────────────────────────────────────────────────────────

export function CashSessionScreen() {
  const [session, setSession] = useState<CashSession | null | undefined>(undefined)
  const [showHistory, setShowHistory] = useState(false)

  const load = useCallback(async () => {
    const current = await window.pos.cashSessions.getCurrent()
    setSession(current)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() is async, setState runs after await not synchronously
  useEffect(() => { load() }, [load])

  if (session === undefined) {
    return <div className="flex items-center justify-center h-full text-zinc-400 text-sm">Cargando…</div>
  }

  return (
    <div className="flex flex-col h-full bg-zinc-50">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-[15px] font-semibold text-zinc-900">Turno de caja</h1>
        <button
          onClick={() => setShowHistory(v => !v)}
          className="text-xs text-brand-600 hover:underline"
        >
          {showHistory ? 'Ocultar historial' : 'Ver historial'}
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {session ? (
          <CloseSessionForm
            session={session}
            onClosed={() => { setSession(null); setShowHistory(true) }}
          />
        ) : (
          <OpenSessionForm onOpened={(s) => setSession(s)} />
        )}

        {showHistory && (
          <div className="px-8 pb-8">
            <SessionHistory />
          </div>
        )}
      </div>
    </div>
  )
}
