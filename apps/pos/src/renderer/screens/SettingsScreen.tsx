import { useState, useEffect, useMemo } from 'react'

type Settings = Record<string, string>

const SCALE_READ_FORMATS = [
  {
    id: 'auto',
    label: 'Automático (recomendado)',
    regex: '',
    help: 'El POS busca un número con decimales en lo que envía la balanza. Funciona con la mayoría de modelos — probá primero con este.',
    example: '1.250 · 0,850',
  },
  {
    id: 'st_gs',
    label: 'Toledo / ST,GS',
    regex: '(?:ST,GS,?\\s*)(\\d+[.,]\\d{1,3})',
    help: 'Para balanzas que envían "ST,GS" antes del peso (común en Toledo y similares).',
    example: 'ST,GS, 1.250',
  },
  {
    id: 'with_kg',
    label: 'Con "kg" al final',
    regex: '(\\d+[.,]\\d{1,3})\\s*kg',
    help: 'Cuando la balanza manda el peso seguido de la unidad "kg".',
    example: '1.250 kg',
  },
  {
    id: 'custom',
    label: 'Personalizado (avanzado)',
    regex: null,
    help: 'Solo si ningún formato anterior funciona. Consultá el manual de tu balanza o pedí ayuda a soporte.',
    example: '',
  },
] as const

type ScaleFormatId = (typeof SCALE_READ_FORMATS)[number]['id']

function resolveScaleFormat(regex: string): ScaleFormatId {
  const trimmed = regex.trim()
  if (!trimmed) return 'auto'
  const match = SCALE_READ_FORMATS.find(p => p.regex && p.regex === trimmed)
  return match?.id ?? 'custom'
}

interface Props {
  onLicenseResult?: () => void
}

export function SettingsScreen({ onLicenseResult }: Props) {
  const [cloudUrl, setCloudUrl]   = useState('')
  const [apiToken, setApiToken]   = useState('')
  const [info, setInfo]           = useState<Settings>({})
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [licenseStatus, setLicenseStatus] = useState<string | null>(null)
  const [syncStatus, setSyncStatus]       = useState<string | null>(null)
  const [resetConfirm, setResetConfirm]   = useState(false)
  const [resetStatus, setResetStatus]     = useState<string | null>(null)
  // Connected scale (serial/USB) — device-local config
  const [scaleEnabled, setScaleEnabled] = useState(false)
  const [scalePort, setScalePort]       = useState('')
  const [scaleBaud, setScaleBaud]       = useState('9600')
  const [scaleRegex, setScaleRegex]     = useState('')
  const [scaleFormat, setScaleFormat]   = useState<ScaleFormatId>('auto')
  const [scalePorts, setScalePorts]     = useState<Array<{ path: string; manufacturer?: string }>>([])
  const [portsLoading, setPortsLoading]   = useState(false)
  const [scaleStatus, setScaleStatus]   = useState<string | null>(null)
  const [scaleSaved, setScaleSaved]     = useState(false)

  useEffect(() => {
    window.pos.settings.get().then((s: Settings) => {
      setCloudUrl(s['cloud_url'] ?? '')
      setApiToken(s['api_token'] ?? '')
      setScaleEnabled(s['scale_enabled'] === '1')
      setScalePort(s['scale_port'] ?? '')
      setScaleBaud(s['scale_baud'] ?? '9600')
      setScaleRegex(s['scale_weight_regex'] ?? '')
      setScaleFormat(resolveScaleFormat(s['scale_weight_regex'] ?? ''))
      setInfo(s)
    })
    void refreshPorts()
  }, [])

  const portOptions = useMemo(() => {
    const paths = new Set(scalePorts.map(p => p.path))
    const opts = [...scalePorts]
    if (scalePort && !paths.has(scalePort)) {
      opts.unshift({ path: scalePort, manufacturer: 'Guardado' })
    }
    return opts
  }, [scalePorts, scalePort])

  async function refreshPorts() {
    setPortsLoading(true)
    const res = await window.pos.scale.listPorts()
    if (res.ok) {
      setScalePorts(res.ports)
    }
    setPortsLoading(false)
    return res
  }

  const activeScaleFormat = SCALE_READ_FORMATS.find(f => f.id === scaleFormat) ?? SCALE_READ_FORMATS[0]

  function handleScaleFormatChange(id: ScaleFormatId) {
    setScaleFormat(id)
    const preset = SCALE_READ_FORMATS.find(f => f.id === id)
    if (preset && preset.regex !== null) {
      setScaleRegex(preset.regex)
    }
  }

  async function handleSaveScale() {
    await window.pos.settings.save({
      scale_enabled: scaleEnabled ? '1' : '0',
      scale_port: scalePort,
      scale_baud: scaleBaud,
      scale_weight_regex: scaleRegex,
    })
    setScaleSaved(true)
    setTimeout(() => setScaleSaved(false), 2000)
  }

  async function handleListPorts() {
    setScaleStatus('Buscando puertos…')
    const res = await refreshPorts()
    if (res.ok) {
      setScaleStatus(res.ports.length ? `✓ ${res.ports.length} puerto(s)` : 'No se detectaron puertos')
    } else {
      setScaleStatus(`Error: ${res.error}`)
    }
    setTimeout(() => setScaleStatus(null), 4000)
  }

  async function handleTestScale() {
    setScaleStatus('Leyendo balanza…')
    const res = await window.pos.scale.readWeight()
    setScaleStatus(res.ok && res.weightKg != null ? `✓ Peso leído: ${res.weightKg.toFixed(3)} kg` : `Error: ${res.error}`)
    setTimeout(() => setScaleStatus(null), 5000)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await window.pos.settings.save({
      cloud_url: cloudUrl,
      api_token: apiToken,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleValidateLicense() {
    setLicenseStatus('Validando…')
    const result = await window.pos.sync.license()
    if (result.valid) {
      const s = await window.pos.settings.get()
      setInfo(s)
      setLicenseStatus('✓ Licencia válida — sucursal y org actualizadas')
    } else {
      setInfo({})
      setLicenseStatus(`Error: ${result.reason ?? 'Licencia inválida'}`)
    }
    // Notificar a App para que re-evalúe el estado de licencia
    onLicenseResult?.()
    setTimeout(() => setLicenseStatus(null), 4000)
  }

  async function handleSyncCatalog() {
    setSyncStatus('Sincronizando…')
    const result = await window.pos.sync.catalog()
    setSyncStatus(result.ok ? '✓ Datos sincronizados correctamente' : `Error: ${result.error}`)
    setTimeout(() => setSyncStatus(null), 3000)
  }

  async function handleSyncSales() {
    setSyncStatus('Enviando ventas pendientes…')
    const result = await window.pos.sync.sales()
    if (result.ok) {
      setSyncStatus(result.synced > 0 ? `✓ ${result.synced} venta(s) sincronizadas` : '✓ No hay ventas pendientes')
    } else {
      setSyncStatus(`Error: ${result.error}`)
    }
    setTimeout(() => setSyncStatus(null), 5000)
  }

  async function handleForceResyncUsers() {
    setSyncStatus('Forzando sincronización de usuarios…')
    try {
      await window.pos.settings.save({ users_synced_at: '1970-01-01T00:00:00.000Z' })
      const result = await window.pos.sync.catalog()
      setSyncStatus(result.ok ? '✓ Usuarios re-sincronizados (PIN incluido)' : `Error: ${result.error}`)
    } finally {
      setTimeout(() => setSyncStatus(null), 4000)
    }
  }

  return (
    <div className="p-6 w-full overflow-y-auto h-full">
      <h1 className="text-base font-semibold text-zinc-900 mb-5">Configuración</h1>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <p className="text-[12px] text-zinc-500">
            Los medios de pago se configuran desde el ERP cloud y se sincronizan automáticamente a este POS.
          </p>
        </div>

        <div>
          <label className="block text-[12px] font-medium text-zinc-700 mb-1">URL del servidor cloud</label>
          <input
            value={cloudUrl}
            onChange={e => setCloudUrl(e.target.value)}
            placeholder="https://tu-instancia.andiko.app"
            className="w-full h-9 px-3 text-[13px] border border-zinc-300 rounded-md bg-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-[12px] font-medium text-zinc-700 mb-1">Token de dispositivo</label>
          <input
            type="password"
            value={apiToken}
            onChange={e => setApiToken(e.target.value)}
            placeholder="Token generado en Andiko ERP"
            className="w-full h-9 px-3 text-[13px] border border-zinc-300 rounded-md bg-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="h-9 px-5 bg-blue-600 text-white text-[13px] font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar'}
        </button>
      </form>

      {/* Auto-populated info from license */}
      {(info['branch_name'] || info['device_id'] || info['org_name']) && (
        <div className="mt-5 p-3 bg-zinc-50 border border-zinc-200 rounded-md space-y-1.5">
          {info['device_name'] && (
            <p className="text-[12px] text-zinc-700 font-medium">{info['device_name']}</p>
          )}
          {info['org_name'] && (
            <p className="text-[11px] text-zinc-500"><span className="font-medium text-zinc-600">Organización:</span> {info['org_name']}</p>
          )}
          {info['branch_name'] && (
            <p className="text-[11px] text-zinc-500"><span className="font-medium text-zinc-600">Sucursal:</span> {info['branch_name']}</p>
          )}
          {info['license_valid_until'] && (
            <p className="text-[11px] text-zinc-500">
              <span className="font-medium text-zinc-600">Licencia:</span>{' '}
              válida hasta {new Date(info['license_valid_until']).toLocaleDateString('es-AR')}
            </p>
          )}
        </div>
      )}

      <div className="mt-6 pt-5 border-t border-zinc-200 space-y-3">
        <h2 className="text-[13px] font-semibold text-zinc-700">Conexión y licencia</h2>
        <button
          onClick={handleValidateLicense}
          className="h-9 px-5 bg-white border border-zinc-300 text-[13px] font-medium rounded-md hover:bg-zinc-50 transition-colors"
        >
          Validar licencia y obtener sucursal
        </button>
        {licenseStatus && <p className="text-[12px] text-zinc-600">{licenseStatus}</p>}
      </div>

      <div className="mt-5 pt-5 border-t border-zinc-200 space-y-3">
        <h2 className="text-[13px] font-semibold text-zinc-700">Sincronización manual</h2>
        <button
          onClick={handleSyncCatalog}
          className="h-9 px-5 bg-white border border-zinc-300 text-[13px] font-medium rounded-md hover:bg-zinc-50 transition-colors"
        >
          Sincronizar datos del cloud
        </button>
        <button
          onClick={handleSyncSales}
          className="h-9 px-5 bg-white border border-zinc-300 text-[13px] font-medium rounded-md hover:bg-zinc-50 transition-colors"
        >
          Enviar ventas pendientes al cloud
        </button>
        <button
          onClick={handleForceResyncUsers}
          className="h-9 px-5 bg-white border border-amber-300 text-[13px] font-medium rounded-md hover:bg-amber-50 transition-colors"
        >
          Forzar re-sincronización de usuarios (PIN)
        </button>
        {syncStatus && <p className="text-[12px] text-zinc-600">{syncStatus}</p>}
      </div>

      <div className="mt-5 pt-5 border-t border-zinc-200 space-y-3">
        <h2 className="text-[13px] font-semibold text-zinc-700">Balanza conectada (serial/USB)</h2>
        <p className="text-[12px] text-zinc-500">
          Para vender por peso con una balanza de mostrador conectada a esta terminal. El formato de las
          etiquetas con código de barras se configura en el ERP cloud (Balanzas).
        </p>

        <label className="flex items-center gap-2 text-[13px] text-zinc-700 cursor-pointer">
          <input type="checkbox" checked={scaleEnabled} onChange={e => setScaleEnabled(e.target.checked)} className="accent-blue-600" />
          Habilitar balanza conectada
        </label>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] font-medium text-zinc-700 mb-1">Puerto</label>
            <select
              value={scalePort}
              onChange={e => setScalePort(e.target.value)}
              disabled={portsLoading}
              className="w-full h-9 px-3 text-[13px] border border-zinc-300 rounded-md bg-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
            >
              <option value="">
                {portsLoading ? 'Buscando puertos…' : 'Seleccionar puerto…'}
              </option>
              {portOptions.map(p => (
                <option key={p.path} value={p.path}>
                  {p.manufacturer ? `${p.path} — ${p.manufacturer}` : p.path}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-zinc-700 mb-1">Baud rate</label>
            <input
              value={scaleBaud}
              onChange={e => setScaleBaud(e.target.value.replace(/\D/g, ''))}
              placeholder="9600"
              inputMode="numeric"
              className="w-full h-9 px-3 text-[13px] border border-zinc-300 rounded-md bg-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-medium text-zinc-700 mb-1">Formato de lectura</label>
          <select
            value={scaleFormat}
            onChange={e => handleScaleFormatChange(e.target.value as ScaleFormatId)}
            className="w-full h-9 px-3 text-[13px] border border-zinc-300 rounded-md bg-white focus:outline-none focus:border-blue-500"
          >
            {SCALE_READ_FORMATS.map(f => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
          <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed">{activeScaleFormat.help}</p>
          {activeScaleFormat.example && (
            <p className="text-[11px] text-zinc-400 mt-1">
              Ejemplo de lectura: <span className="font-mono text-zinc-600">{activeScaleFormat.example}</span>
            </p>
          )}
          {scaleFormat === 'custom' && (
            <div className="mt-2 p-3 bg-zinc-50 border border-zinc-200 rounded-md space-y-1.5">
              <label className="block text-[11px] font-medium text-zinc-600">Patrón personalizado</label>
              <input
                value={scaleRegex}
                onChange={e => setScaleRegex(e.target.value)}
                placeholder="(\d+[.,]\d{1,3})"
                className="w-full h-9 px-3 text-[13px] font-mono border border-zinc-300 rounded-md bg-white focus:outline-none focus:border-blue-500"
              />
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Configuración avanzada: expresión que indica dónde está el peso en cada línea que envía la balanza.
              </p>
            </div>
          )}
          <p className="text-[11px] text-zinc-400 mt-2">
            Si <span className="font-medium text-zinc-500">Probar balanza</span> no lee el peso, probá otro formato antes de cambiar el puerto o el baud rate.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={handleSaveScale} className="h-9 px-5 bg-blue-600 text-white text-[13px] font-medium rounded-md hover:bg-blue-700 transition-colors">
            {scaleSaved ? '✓ Guardado' : 'Guardar balanza'}
          </button>
          <button onClick={handleListPorts} disabled={portsLoading} className="h-9 px-5 bg-white border border-zinc-300 text-[13px] font-medium rounded-md hover:bg-zinc-50 disabled:opacity-50 transition-colors">
            {portsLoading ? 'Buscando…' : 'Actualizar puertos'}
          </button>
          <button onClick={handleTestScale} className="h-9 px-5 bg-white border border-zinc-300 text-[13px] font-medium rounded-md hover:bg-zinc-50 transition-colors">
            Probar balanza
          </button>
        </div>
        {scaleStatus && <p className="text-[12px] text-zinc-600">{scaleStatus}</p>}
      </div>

      <div className="mt-5 pt-5 border-t-2 border-red-200 space-y-3">
        <h2 className="text-[13px] font-semibold text-red-700">Zona de peligro</h2>
        <p className="text-[12px] text-zinc-500">
          Elimina todos los datos locales: productos, clientes, usuarios, ventas, turnos y configuración.
          No afecta el cloud. Útil para resetear datos de desarrollo.
        </p>
        <button
          onClick={async () => {
            if (!resetConfirm) { setResetConfirm(true); setTimeout(() => setResetConfirm(false), 5000); return }
            setResetConfirm(false)
            const result = await window.pos.dev.resetLocalData()
            setResetStatus(result.ok ? '✓ Datos locales eliminados. Reiniciá el POS.' : `Error: ${result.error}`)
          }}
          className={`h-9 px-5 text-[13px] font-medium rounded-md transition-colors ${
            resetConfirm
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-white border border-red-300 text-red-600 hover:bg-red-50'
          }`}
        >
          {resetConfirm ? '¿Seguro? Hacé click de nuevo para confirmar' : 'Limpiar todos los datos locales'}
        </button>
        {resetStatus && <p className="text-[12px] text-red-700">{resetStatus}</p>}
      </div>
    </div>
  )
}
