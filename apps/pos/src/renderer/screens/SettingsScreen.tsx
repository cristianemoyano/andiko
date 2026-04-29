import { useState, useEffect } from 'react'

type Settings = Record<string, string>

interface Props {
  onLicenseResult?: () => void
}

export function SettingsScreen({ onLicenseResult }: Props) {
  const [cloudUrl, setCloudUrl]   = useState('')
  const [apiToken, setApiToken]   = useState('')
  const [cashierUserId, setCashierUserId] = useState('')
  const [cashierName, setCashierName] = useState('')
  const [cashierOpen, setCashierOpen] = useState(false)
  const [cashierQuery, setCashierQuery] = useState('')
  const [cashierRows, setCashierRows] = useState<Array<{ id: string; name: string; email: string; role: string; branch_id: string | null }>>([])
  const [cashierError, setCashierError] = useState<string | null>(null)
  const [cashierPinOpen, setCashierPinOpen] = useState(false)
  const [cashierPinValue, setCashierPinValue] = useState('')
  const [cashierPinUser, setCashierPinUser] = useState<null | { id: string; name: string }>(null)
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
      setCashierUserId(s['cashier_user_id'] ?? '')
      setCashierName(s['cashier_name'] ?? '')
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
      cashier_user_id: cashierUserId,
      cashier_name: cashierName,
      pos_payment_methods: JSON.stringify(posPaymentMethods),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function persistCashier(next: { id: string; name: string }) {
    setCashierUserId(next.id)
    setCashierName(next.name)
    // Persist immediately so SaleScreen sees it without hitting "Guardar"
    await window.pos.settings.save({ cashier_user_id: next.id, cashier_name: next.name })
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
    <div className="p-6 max-w-lg">
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
          <label className="block text-[12px] font-medium text-zinc-700 mb-1">Cajero/a</label>
          <button
            type="button"
            onClick={async () => {
              setCashierOpen(true)
              setCashierError(null)
              const res = await window.pos.users.search('')
              if (!res.ok) setCashierError(res.error ?? 'Error buscando usuarios')
              setCashierRows(res.data)
            }}
            className="w-full h-9 px-3 text-left text-[13px] border border-zinc-300 rounded-md bg-white hover:bg-zinc-50 transition-colors"
          >
            {cashierName ? cashierName : 'Seleccionar usuario…'}
          </button>
          <p className="mt-1 text-[11px] text-zinc-500">
            Se elige desde los usuarios de la organización (cloud). Queda guardado localmente para modo offline.
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

      {cashierOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-800">Seleccionar cajero/a</div>
              <button
                onClick={() => setCashierOpen(false)}
                className="text-[12px] font-medium text-zinc-600 hover:text-zinc-900"
              >
                Cerrar
              </button>
            </div>
            <div className="p-4 space-y-3">
              <input
                value={cashierQuery}
                onChange={async (e) => {
                  const q = e.target.value
                  setCashierQuery(q)
                  setCashierError(null)
                  const res = await window.pos.users.search(q)
                  if (!res.ok) setCashierError(res.error ?? 'Error buscando usuarios')
                  setCashierRows(res.data)
                }}
                placeholder="Buscar por nombre o email…"
                className="w-full h-10 px-3 text-[13px] border border-zinc-300 rounded-md bg-white focus:outline-none focus:border-blue-500"
              />

              {cashierError && (
                <div className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {cashierError}
                </div>
              )}

              <div className="max-h-[360px] overflow-y-auto border border-zinc-200 rounded-lg divide-y divide-zinc-100">
                {cashierRows.map(u => (
                  <button
                    key={u.id}
                    onClick={async () => {
                      setCashierError(null)
                      setCashierPinUser({ id: u.id, name: u.name })
                      setCashierPinValue('')
                      setCashierPinOpen(true)
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-zinc-50 transition-colors"
                  >
                    <div className="text-[13px] font-medium text-zinc-900 truncate">{u.name}</div>
                    <div className="text-[11px] text-zinc-500 truncate">{u.email} · {u.role}</div>
                  </button>
                ))}
                {cashierRows.length === 0 && (
                  <div className="px-3 py-6 text-center text-[12px] text-zinc-500">
                    Sin resultados.
                  </div>
                )}
              </div>
            </div>
          </div>

          {cashierPinOpen && cashierPinUser && (
            <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
              <div className="w-full max-w-sm bg-white rounded-xl shadow-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
                  <div className="text-sm font-semibold text-zinc-800">PIN de cajero/a</div>
                  <button
                    onClick={() => { setCashierPinOpen(false); setCashierPinUser(null); setCashierPinValue('') }}
                    className="text-[12px] font-medium text-zinc-600 hover:text-zinc-900"
                  >
                    Cerrar
                  </button>
                </div>
                <div className="p-4 space-y-3">
                  <div className="text-[12px] text-zinc-600">
                    Ingresá el PIN para <span className="font-medium text-zinc-900">{cashierPinUser.name}</span>.
                  </div>
                  <input
                    type="password"
                    value={cashierPinValue}
                    onChange={(e) => { setCashierPinValue(e.target.value); setCashierError(null) }}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return
                      e.preventDefault()
                      void (async () => {
                        const pin = cashierPinValue.trim()
                        if (!pin) { setCashierError('PIN requerido para asignar cajero/a.'); return }
                        const res = await window.pos.users.verifyPin({ user_id: cashierPinUser.id, pin })
                        if (!res.ok) { setCashierError(res.error ?? 'PIN incorrecto'); return }
                        await persistCashier({ id: cashierPinUser.id, name: cashierPinUser.name })
                        setCashierPinOpen(false)
                        setCashierPinUser(null)
                        setCashierPinValue('')
                        setCashierOpen(false)
                        setSaved(true)
                        setTimeout(() => setSaved(false), 1500)
                      })()
                    }}
                    placeholder="PIN…"
                    className="w-full h-10 px-3 text-[13px] border border-zinc-300 rounded-md bg-white focus:outline-none focus:border-blue-500"
                  />
                  {cashierError && (
                    <div className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                      {cashierError}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      void (async () => {
                        const pin = cashierPinValue.trim()
                        if (!pin) { setCashierError('PIN requerido para asignar cajero/a.'); return }
                        const res = await window.pos.users.verifyPin({ user_id: cashierPinUser.id, pin })
                        if (!res.ok) { setCashierError(res.error ?? 'PIN incorrecto'); return }
                        await persistCashier({ id: cashierPinUser.id, name: cashierPinUser.name })
                        setCashierPinOpen(false)
                        setCashierPinUser(null)
                        setCashierPinValue('')
                        setCashierOpen(false)
                        setSaved(true)
                        setTimeout(() => setSaved(false), 1500)
                      })()
                    }}
                    className="w-full h-10 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
