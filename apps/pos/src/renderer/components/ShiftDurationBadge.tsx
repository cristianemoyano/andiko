import {
  formatShiftDuration,
  SHIFT_CAUTION_HOURS,
  SHIFT_OVERDUE_HOURS,
  type ShiftDurationState,
} from '../lib/cash-session-duration'

const STATE_STYLES: Record<ShiftDurationState, string> = {
  normal: 'bg-zinc-100 text-zinc-700',
  caution: 'bg-amber-100 text-amber-800',
  overdue: 'bg-red-100 text-red-800',
}

interface Props {
  durationMs: number
  state: ShiftDurationState
  compact?: boolean
}

export function ShiftDurationBadge({ durationMs, state, compact }: Props) {
  const label = formatShiftDuration(durationMs)

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium tabular-nums ${STATE_STYLES[state]}`}
      title={`Turno abierto hace ${label}`}
    >
      {!compact && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      )}
      {label}
    </span>
  )
}

interface BannerProps {
  state: ShiftDurationState
}

export function ShiftDurationWarning({ state }: BannerProps) {
  if (state === 'normal') return null

  const message = state === 'overdue'
    ? `Este turno superó las ${SHIFT_OVERDUE_HOURS} horas. Cerralo y abrí uno nuevo para cuadrar la caja y evitar mezclar ventas de distintos días.`
    : `El turno lleva más de ${SHIFT_CAUTION_HOURS} horas abierto. Considerá cerrarlo al finalizar la jornada.`

  return (
    <div
      role="status"
      className={`rounded-lg border px-4 py-3 text-[12px] leading-snug ${
        state === 'overdue'
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-amber-200 bg-amber-50 text-amber-900'
      }`}
    >
      {message}
    </div>
  )
}
