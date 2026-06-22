import { AndikoMark } from '../components/AndikoMark'

interface Props {
  reason: 'revoked' | 'expired' | 'no_config' | 'unknown'
  offlineDaysLeft?: number
  onRetry: () => void
  retrying: boolean
  onConfigure: () => void
}

const MESSAGES: Record<string, { title: string; body: string }> = {
  revoked:    { title: 'Dispositivo revocado', body: 'Este dispositivo fue desactivado. Contactá al administrador de Andiko.' },
  expired:    { title: 'Licencia vencida', body: 'La licencia offline venció. Conectate al servidor para renovarla.' },
  no_config:  { title: 'Sin configuración', body: 'Configurá la URL del servidor y el token del dispositivo antes de continuar.' },
  unknown:    { title: 'Error de licencia', body: 'No se pudo validar la licencia. Verificá la conexión y el token.' },
}

const SHOW_CONFIGURE: Record<string, boolean> = {
  revoked:   true,
  no_config: true,
  expired:   true,
  unknown:   true,
}

export function LicenseBlockScreen({ reason, offlineDaysLeft, onRetry, retrying, onConfigure }: Props) {
  const { title, body } = MESSAGES[reason] ?? MESSAGES.unknown
  const showConfigure = SHOW_CONFIGURE[reason] ?? false

  return (
    <div className="flex h-screen bg-zinc-950 items-center justify-center p-8">
      <div className="max-w-sm w-full text-center flex flex-col items-center gap-6">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-lg font-semibold text-white">{title}</h1>
          <p className="text-sm text-zinc-400 leading-relaxed">{body}</p>
          {offlineDaysLeft !== undefined && offlineDaysLeft > 0 && (
            <p className="text-xs text-amber-400 mt-1">
              Modo offline: {offlineDaysLeft} día{offlineDaysLeft !== 1 ? 's' : ''} restante{offlineDaysLeft !== 1 ? 's' : ''} de gracia
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 w-full">
          <button
            onClick={onRetry}
            disabled={retrying}
            className="h-10 px-6 bg-brand-600 text-white text-[13px] font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {retrying ? 'Verificando…' : 'Reintentar'}
          </button>

          {showConfigure && (
            <button
              onClick={onConfigure}
              className="h-10 px-6 bg-transparent border border-zinc-700 text-zinc-400 text-[13px] font-medium rounded-lg hover:border-zinc-500 hover:text-zinc-200 transition-colors"
            >
              Configurar dispositivo
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-zinc-500">
          <AndikoMark size="xs" tone="muted" />
          <span className="text-[11px] font-medium">Andiko POS</span>
        </div>
      </div>
    </div>
  )
}
