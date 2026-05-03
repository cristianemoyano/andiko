import { useState, useEffect } from 'react'

type Settings = Record<string, string>

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
  const [posPaymentMethods, setPosPaymentMethods] = useState<Array<'cash' | 'card' | 'transfer'>>(['cash', 'card', 'transfer'])

  useEffect(() => {
    window.pos.settings.get().then((s: Settings) => {
      setCloudUrl(s['cloud_url'] ?? '')
      setApiToken(s['api_token'] ?? '')
      try {
        const raw = s['pos_payment_methods']
        if (raw) {
          const parsed = JSON.parse(raw) as unknown
          if (Array.isArray(parsed)) {
            const allowed = new Set(['cash', 'card', 'transfer'])
            const cleaned = parsed.filter((x): x is 'cash' | 'card' | 'transfer' => typeof x === 'string' && allowed.has(x))
            if (cleaned.length > 0) setPosPaymentMethods(cleaned)
          }
        }
      } catch {
        // ignore malformed local setting
      }
      setInfo(s)
    })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await window.pos.settings.save({
      cloud_url: cloudUrl,
      api_token: apiToken,
      pos_payment_methods: JSON.stringify(posPaymentMethods),
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
    setSyncStatus(result.ok ? '✓ Catálogo, clientes y usuarios actualizado' : `Error: ${result.error}`)
    setTimeout(() => setSyncStatus(null), 3000)
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
          <label className="block text-[12px] font-medium text-zinc-700 mb-2">Métodos de pago habilitados (POS)</label>
          <div className="flex flex-col gap-2">
            {(['cash', 'card', 'transfer'] as const).map((m) => {
              const checked = posPaymentMethods.includes(m)
              const label = m === 'cash' ? 'Efectivo' : m === 'card' ? 'Tarjeta' : 'Transferencia'
              return (
                <label key={m} className="flex items-center gap-2 text-[13px] text-zinc-800">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? Array.from(new Set([...posPaymentMethods, m]))
                        : posPaymentMethods.filter(x => x !== m)
                      // Don't allow empty selection
                      if (next.length === 0) return
                      setPosPaymentMethods(next)
                    }}
                  />
                  <span>{label}</span>
                </label>
              )
            })}
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            Se usan en la pantalla de cobro. (Se guardan localmente en este POS.)
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
          Sincronizar catálogo, clientes y usuarios
        </button>
        <button
          onClick={handleForceResyncUsers}
          className="h-9 px-5 bg-white border border-amber-300 text-[13px] font-medium rounded-md hover:bg-amber-50 transition-colors"
        >
          Forzar re-sincronización de usuarios (PIN)
        </button>
        {syncStatus && <p className="text-[12px] text-zinc-600">{syncStatus}</p>}
      </div>
    </div>
  )
}
