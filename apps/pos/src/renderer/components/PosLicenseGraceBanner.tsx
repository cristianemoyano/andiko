interface Props {
  daysLeft: number
  onRetry: () => void
  retrying: boolean
}

export function PosLicenseGraceBanner({ daysLeft, onRetry, retrying }: Props) {
  const daysLabel = `${daysLeft} día${daysLeft !== 1 ? 's' : ''}`

  return (
    <div
      role="status"
      className="shrink-0 flex items-center justify-center gap-3 flex-wrap border-b border-orange-700/30 bg-orange-600 px-4 py-2 text-[12px] font-medium text-white"
    >
      <span className="text-center leading-snug">
        Sin conexión al servidor — {daysLabel} de gracia restante{daysLeft !== 1 ? 's' : ''}. Conectate para renovar la licencia.
      </span>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="shrink-0 rounded-md border border-white/30 bg-white/15 px-3 py-1 text-[11px] font-semibold text-white hover:bg-white/25 disabled:opacity-50 transition-colors"
      >
        {retrying ? 'Verificando…' : 'Reintentar'}
      </button>
    </div>
  )
}
