import { usePosDeviceInfo } from '../lib/usePosDeviceInfo'
import { usePosCashier } from '../lib/usePosCashier'
import { OrgMonogram } from './OrgMonogram'

function ConnectivityPill({ online }: { online: boolean }) {
  return (
    <span
      title={online ? 'Conectado al cloud' : 'Sin conexión — modo offline'}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium ${
        online ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`} />
      {online ? 'En línea' : 'Sin conexión'}
    </span>
  )
}

export function PosDeviceContextBar({ online = true, refreshKey }: { online?: boolean; refreshKey?: string }) {
  const { orgName, branchName, deviceName, deviceId, loading } = usePosDeviceInfo()
  const { cashierName, hasSession, loading: cashierLoading } = usePosCashier(refreshKey)

  if (loading) {
    return (
      <header className="shrink-0 border-b border-zinc-200 bg-white px-4 py-2.5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-zinc-100 animate-pulse" />
        <div className="flex flex-col gap-1.5">
          <div className="h-3 w-32 rounded bg-zinc-100 animate-pulse" />
          <div className="h-2.5 w-20 rounded bg-zinc-100 animate-pulse" />
        </div>
      </header>
    )
  }

  if (!branchName && !orgName && !deviceName && !deviceId) {
    return (
      <header className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2.5 flex items-center justify-between gap-3">
        <span className="text-[14px] font-medium text-amber-800">
          Sin sucursal asignada — validá la licencia en Configuración
        </span>
        <ConnectivityPill online={online} />
      </header>
    )
  }

  const deviceLabel = deviceName ?? deviceId

  return (
    <header className="shrink-0 border-b border-zinc-200 bg-white px-4 py-2.5 flex items-center justify-between gap-3 min-w-0">
      {/* Org brand — protagonista */}
      <div className="flex items-center gap-3 min-w-0">
        <OrgMonogram name={orgName} size="md" />
        <div className="flex flex-col min-w-0 leading-tight">
          <span className="truncate text-base font-semibold text-zinc-900 tracking-tight">
            {orgName ?? 'Comercio sin nombre'}
          </span>
          {branchName && (
            <span className="inline-flex items-center gap-1 min-w-0 text-[13px] text-zinc-500">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0" aria-hidden>
                <path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" />
              </svg>
              <span className="truncate">{branchName}</span>
            </span>
          )}
        </div>
      </div>

      {/* Cashier + device + connectivity */}
      <div className="flex items-center gap-2.5 shrink-0">
        {!cashierLoading && (
          hasSession && cashierName ? (
            <span
              title={`Cajero/a: ${cashierName}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[13px] font-medium text-green-800 max-w-[200px]"
            >
              <span
                className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-[10px] font-semibold flex items-center justify-center shrink-0"
                aria-hidden
              >
                {cashierName.charAt(0).toUpperCase()}
              </span>
              <span className="truncate">{cashierName}</span>
            </span>
          ) : (
            <span
              title="Abrí un turno de caja para poder cobrar"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[13px] font-medium text-amber-800"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0" aria-hidden>
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Sin turno
            </span>
          )
        )}
        {deviceLabel && (
          <span
            title={deviceLabel}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[13px] font-medium text-zinc-600 max-w-[180px]"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-zinc-400" aria-hidden>
              <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span className="truncate">{deviceLabel}</span>
          </span>
        )}
        <ConnectivityPill online={online} />
      </div>
    </header>
  )
}
