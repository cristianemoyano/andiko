import { usePosDeviceInfo } from '../lib/usePosDeviceInfo'

export function PosDeviceContextBar() {
  const { orgName, branchName, deviceName, deviceId, loading } = usePosDeviceInfo()

  if (loading) {
    return (
      <div className="shrink-0 border-b border-zinc-200 bg-zinc-50 px-4 py-1.5 text-[11px] text-zinc-400">
        Cargando dispositivo…
      </div>
    )
  }

  if (!branchName && !orgName && !deviceName && !deviceId) {
    return (
      <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-[11px] text-amber-800">
        Sin sucursal asignada — validá la licencia en Configuración
      </div>
    )
  }

  const deviceLabel = deviceName ?? deviceId

  return (
    <div
      className="shrink-0 border-b border-zinc-200 bg-zinc-50 px-4 py-1.5 flex items-center gap-2 min-w-0 text-[11px] text-zinc-600"
      title={[orgName, branchName, deviceLabel].filter(Boolean).join(' · ')}
    >
      {branchName && (
        <span className="inline-flex items-center gap-1 min-w-0 font-medium text-zinc-800">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-zinc-500" aria-hidden>
            <path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/>
          </svg>
          <span className="truncate">{branchName}</span>
        </span>
      )}
      {orgName && (
        <>
          {branchName && <span className="text-zinc-300 shrink-0">·</span>}
          <span className="truncate text-zinc-500">{orgName}</span>
        </>
      )}
      {deviceLabel && (
        <>
          {(branchName || orgName) && <span className="text-zinc-300 shrink-0">·</span>}
          <span className="truncate text-zinc-400">{deviceLabel}</span>
        </>
      )}
    </div>
  )
}
