export type SalesDatePreset = 'today' | 'yesterday' | 'week' | 'all' | 'custom'

export type SalesHistoryFilterState = {
  datePreset: SalesDatePreset
  customDate: string
  paymentMethod: string
  ticketQuery: string
}

export const DEFAULT_SALES_HISTORY_FILTERS: SalesHistoryFilterState = {
  datePreset: 'week',
  customDate: '',
  paymentMethod: '',
  ticketQuery: '',
}

function localDateKey(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayKey(): string {
  return localDateKey(new Date().toISOString())
}

function yesterdayKey(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return localDateKey(d.toISOString())
}

export function saleMatchesDateFilter(soldAt: string, filters: SalesHistoryFilterState): boolean {
  const key = localDateKey(soldAt)
  switch (filters.datePreset) {
    case 'today':
      return key === todayKey()
    case 'yesterday':
      return key === yesterdayKey()
    case 'week': {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      start.setDate(start.getDate() - 6)
      const sold = new Date(soldAt)
      return sold >= start
    }
    case 'custom':
      return filters.customDate ? key === filters.customDate : true
    case 'all':
    default:
      return true
  }
}

export function salePaymentMethods(paymentsJson: string | null): string[] {
  try {
    const payments: Array<{ payment_method_name?: string }> = JSON.parse(paymentsJson ?? '[]')
    return payments.map(p => p.payment_method_name?.trim()).filter((n): n is string => Boolean(n))
  } catch {
    return []
  }
}

export function saleMatchesPaymentFilter(paymentsJson: string | null, paymentMethod: string): boolean {
  if (!paymentMethod) return true
  return salePaymentMethods(paymentsJson).includes(paymentMethod)
}

export function saleMatchesTicketQuery(
  row: { id: string; ticket_number: string | null },
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const ticket = (row.ticket_number ?? '').toLowerCase()
  const idShort = row.id.slice(0, 8).toLowerCase()
  return ticket.includes(q) || row.id.toLowerCase().includes(q) || idShort.includes(q)
}

function filtersActive(filters: SalesHistoryFilterState, defaults = DEFAULT_SALES_HISTORY_FILTERS): boolean {
  return (
    filters.datePreset !== defaults.datePreset ||
    filters.customDate !== defaults.customDate ||
    filters.paymentMethod !== defaults.paymentMethod ||
    filters.ticketQuery.trim() !== defaults.ticketQuery.trim()
  )
}

const DATE_PRESETS: Array<{ id: SalesDatePreset; label: string }> = [
  { id: 'today', label: 'Hoy' },
  { id: 'yesterday', label: 'Ayer' },
  { id: 'week', label: '7 días' },
  { id: 'all', label: 'Todas' },
  { id: 'custom', label: 'Fecha' },
]

interface Props {
  mode: 'paid' | 'draft'
  filters: SalesHistoryFilterState
  onChange: (next: SalesHistoryFilterState) => void
  paymentMethodOptions: string[]
  resultCount: number
  totalCount: number
}

export function SalesHistoryFilters({
  mode,
  filters,
  onChange,
  paymentMethodOptions,
  resultCount,
  totalCount,
}: Props) {
  const active = filtersActive(filters)

  function patch(partial: Partial<SalesHistoryFilterState>) {
    onChange({ ...filters, ...partial })
  }

  return (
    <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 shrink-0">Período</span>
        <div className="flex flex-wrap items-center gap-1">
          {DATE_PRESETS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => patch({ datePreset: id, customDate: id === 'custom' ? filters.customDate || todayKey() : '' })}
              className={`h-8 px-3 rounded-md text-[12px] font-medium transition-colors ${
                filters.datePreset === id
                  ? 'bg-zinc-900 text-white'
                  : 'bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {filters.datePreset === 'custom' && (
          <input
            type="date"
            value={filters.customDate}
            onChange={e => patch({ customDate: e.target.value })}
            className="h-8 px-2 text-[12px] border border-zinc-300 rounded-md bg-white focus:outline-none focus:border-blue-500"
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {mode === 'paid' && (
          <>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 shrink-0" htmlFor="sales-filter-payment">
              Medio de pago
            </label>
            <select
              id="sales-filter-payment"
              value={filters.paymentMethod}
              onChange={e => patch({ paymentMethod: e.target.value })}
              className="h-8 min-w-[140px] max-w-[200px] px-2 text-[12px] border border-zinc-300 rounded-md bg-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Todos</option>
              {paymentMethodOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </>
        )}

        <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 shrink-0" htmlFor="sales-filter-ticket">
          {mode === 'paid' ? 'Nº ticket' : 'Borrador'}
        </label>
        <input
          id="sales-filter-ticket"
          type="search"
          value={filters.ticketQuery}
          onChange={e => patch({ ticketQuery: e.target.value })}
          placeholder={mode === 'paid' ? 'Ej. 0002-00000001' : 'ID o cajero/a'}
          className="h-8 w-44 px-2.5 text-[12px] border border-zinc-300 rounded-md bg-white focus:outline-none focus:border-blue-500"
        />

        <div className="flex-1 min-w-[8rem]" />

        <span className="text-[11px] text-zinc-500 tabular-nums">
          {resultCount === totalCount
            ? `${totalCount} ${mode === 'paid' ? 'ventas' : 'borradores'}`
            : `${resultCount} de ${totalCount}`}
        </span>

        {active && (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_SALES_HISTORY_FILTERS)}
            className="h-8 px-3 text-[12px] font-medium text-zinc-600 hover:text-zinc-900 underline-offset-2 hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  )
}
