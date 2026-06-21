'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Switch } from '@/components/primitives/Switch'
import { Select } from '@/components/primitives/Select'
import { FormField } from '@/components/primitives/FormField'
import { fetchJson } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'
import {
  parseBalanzaBarcode,
  DEFAULT_BALANZA_CONFIG,
  type BalanzaBarcodeConfig,
} from '@/modules/pos/balanza-barcode'

const NUM_FIELDS: Array<{ key: keyof BalanzaBarcodeConfig; label: string; hint?: string }> = [
  { key: 'totalLength', label: 'Largo total', hint: 'Cantidad de dígitos (13 para EAN-13)' },
  { key: 'itemCodeStart', label: 'Inicio código (PLU)', hint: 'Posición 0-based' },
  { key: 'itemCodeLength', label: 'Largo código (PLU)' },
  { key: 'valueStart', label: 'Inicio valor', hint: 'Posición 0-based' },
  { key: 'valueLength', label: 'Largo valor' },
  { key: 'valueDivisor', label: 'Divisor', hint: 'Precio: 100 (centavos) · Peso: 1000 (gramos)' },
]

export function BalanzasClient() {
  const [cfg, setCfg] = useState<BalanzaBarcodeConfig>({ ...DEFAULT_BALANZA_CONFIG })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [testCode, setTestCode] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchJson<{ data: BalanzaBarcodeConfig }>('/api/v1/pos/balanza-config')
      .then(res => { if (!cancelled) { setCfg(res.data); setLoading(false) } })
      .catch(err => { if (!cancelled) { notifyApiError(err); setLoading(false) } })
    return () => { cancelled = true }
  }, [refresh])

  function setNum(key: keyof BalanzaBarcodeConfig, raw: string) {
    const n = parseInt(raw, 10)
    setCfg(c => ({ ...c, [key]: Number.isNaN(n) ? 0 : n }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await fetchJson('/api/v1/pos/balanza-config', { method: 'PUT', body: JSON.stringify(cfg) })
      notifySuccess('Configuración de balanza guardada')
      setRefresh(r => r + 1)
    } catch (err) {
      notifyApiError(err)
    } finally {
      setSaving(false)
    }
  }

  const parsed = testCode.trim() ? parseBalanzaBarcode(testCode, cfg) : null

  return (
    <>
      <TopBar
        breadcrumbs={[{ label: 'POS' }, { label: 'Balanzas' }]}
        actions={<Button size="sm" onClick={handleSave} disabled={saving || loading}>{saving ? 'Guardando…' : 'Guardar'}</Button>}
      />

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-fg-subtle text-sm">Cargando…</div>
        ) : (
          <div className="max-w-2xl space-y-6">
            <p className="text-sm text-fg-muted">
              Configurá cómo se leen las etiquetas de balanza (Kretz, Systel, Gemini). El cajero escanea el
              código y el POS agrega el producto pesado automáticamente. Esta configuración se sincroniza a
              los dispositivos POS.
            </p>

            <Switch
              checked={cfg.enabled}
              onCheckedChange={(v) => setCfg(c => ({ ...c, enabled: v }))}
              label="Habilitar lectura de etiquetas de balanza"
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Prefijo" htmlFor="prefix">
                <Input
                  id="prefix"
                  value={cfg.prefix}
                  onChange={(e) => setCfg(c => ({ ...c, prefix: e.target.value.replace(/\D/g, '') }))}
                  placeholder="20"
                />
                <p className="text-xs text-fg-subtle mt-1">Dígitos iniciales que identifican una etiqueta de balanza.</p>
              </FormField>

              <FormField label="Tipo de valor" htmlFor="valueType">
                <Select
                  id="valueType"
                  value={cfg.valueType}
                  onChange={(v) => setCfg(c => ({ ...c, valueType: v as BalanzaBarcodeConfig['valueType'] }))}
                  options={[
                    { value: 'price', label: 'Precio total (centavos)' },
                    { value: 'weight', label: 'Peso (gramos)' },
                  ]}
                />
              </FormField>

              {NUM_FIELDS.map(f => (
                <FormField key={f.key} label={f.label} htmlFor={f.key}>
                  <Input
                    id={f.key}
                    type="number"
                    value={String(cfg[f.key] as number)}
                    onChange={(e) => setNum(f.key, e.target.value)}
                  />
                  {f.hint && <p className="text-xs text-fg-subtle mt-1">{f.hint}</p>}
                </FormField>
              ))}
            </div>

            <Switch
              checked={cfg.validateCheckDigit}
              onCheckedChange={(v) => setCfg(c => ({ ...c, validateCheckDigit: v }))}
              label="Validar dígito verificador EAN-13"
            />

            {/* Live tester */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="text-sm font-medium text-fg">Probar código</div>
              <Input
                value={testCode}
                onChange={(e) => setTestCode(e.target.value)}
                placeholder="Pegá un código de balanza de ejemplo…"
              />
              {testCode.trim() && (
                parsed ? (
                  <div className="text-[13px] text-fg-muted space-y-1">
                    <div>PLU: <span className="font-mono text-fg">{parsed.pluCode}</span></div>
                    {parsed.weightKg != null && <div>Peso: <span className="font-mono text-fg">{parsed.weightKg} kg</span></div>}
                    {parsed.priceArs != null && <div>Precio: <span className="font-mono text-fg">$ {parsed.priceArs}</span></div>}
                  </div>
                ) : (
                  <div className="text-[13px] text-danger">El código no coincide con esta configuración.</div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
