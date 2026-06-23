'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
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

/** Valid EAN-13 examples (PLU 00037). */
const EXAMPLE_CODES = {
  price: { code: '2000037015006', label: 'Precio $15' },
  weight: { code: '2000037008503', label: 'Peso 0,850 kg' },
} as const

type ExampleKey = keyof typeof EXAMPLE_CODES

function SettingSwitch({
  checked,
  onCheckedChange,
  label,
  description,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
  description: string
}) {
  return (
    <div className="space-y-1">
      <Switch checked={checked} onCheckedChange={onCheckedChange} label={label} />
      <p className="text-xs text-fg-subtle leading-relaxed pl-11">{description}</p>
    </div>
  )
}

const TUTORIAL_STEPS = [
  {
    title: 'Productos en el catálogo',
    body: 'Cada artículo pesado necesita estar marcado como vendido por peso y tener un código PLU que coincida con el de la balanza.',
  },
  {
    title: 'Guardar y sincronizar',
    body: 'Guardá esta configuración. En cada terminal POS: Configuración → Validar licencia → Sincronizar datos del cloud.',
  },
  {
    title: 'Escanear en la venta',
    body: 'El cajero escanea la etiqueta en el buscador de productos y aprieta Enter. El POS agrega la línea con el PLU, peso o precio de la etiqueta.',
  },
] as const

function BalanzaTutorialPanel() {
  return (
    <div className="bg-surface border border-border rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-surface-muted/30">
        <h2 className="text-sm font-semibold text-fg">Cómo funciona</h2>
        <p className="text-xs text-fg-subtle mt-1 leading-relaxed">
          Guía rápida para poner en marcha las etiquetas de balanza en el POS.
        </p>
      </div>

      <ol className="p-5 space-y-4">
        {TUTORIAL_STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 text-[11px] font-semibold">
              {i + 1}
            </span>
            <div className="min-w-0 pt-0.5">
              <div className="text-[13px] font-medium text-fg">{step.title}</div>
              <p className="text-xs text-fg-muted mt-1 leading-relaxed">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="px-5 pb-5">
        <div className="rounded-sm border border-border bg-surface-muted/40 p-4 space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
            Anatomía del código (EAN-13)
          </div>
          <div className="font-mono text-[13px] text-fg tracking-wide">
            <span className="text-brand-700">20</span>
            <span className="text-fg-muted">00037</span>
            <span className="text-emerald-700">01500</span>
            <span className="text-fg-subtle">6</span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[11px]">
            <dt className="text-fg-subtle">20</dt>
            <dd className="text-fg-muted">Prefijo de balanza</dd>
            <dt className="text-fg-subtle font-mono">00037</dt>
            <dd className="text-fg-muted">PLU del producto</dd>
            <dt className="text-fg-subtle font-mono">01500</dt>
            <dd className="text-fg-muted">Precio en centavos ($15,00)</dd>
            <dt className="text-fg-subtle font-mono">6</dt>
            <dd className="text-fg-muted">Dígito verificador EAN-13</dd>
          </dl>
        </div>

        <p className="text-[11px] text-fg-subtle mt-4 leading-relaxed">
          Si también usás balanza conectada por USB en el mostrador, configurá el puerto en el POS
          (Configuración → Balanza conectada). Las etiquetas impresas y el peso en vivo son flujos distintos.
        </p>
      </div>
    </div>
  )
}

export function BalanzasClient() {
  const [cfg, setCfg] = useState<BalanzaBarcodeConfig>({ ...DEFAULT_BALANZA_CONFIG })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [testCode, setTestCode] = useState('')
  const [activeExample, setActiveExample] = useState<ExampleKey | null>('price')

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

  const effectiveCode = testCode.trim() || (activeExample ? EXAMPLE_CODES[activeExample].code : '')
  const parsed = effectiveCode ? parseBalanzaBarcode(effectiveCode, cfg) : null

  return (
    <>
      <TopBar
        breadcrumbs={[{ label: 'POS' }, { label: 'Balanzas' }]}
        actions={<Button size="sm" onClick={handleSave} disabled={saving || loading}>{saving ? 'Guardando…' : 'Guardar'}</Button>}
      />

      <PageBody padding="p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-fg-subtle text-sm">Cargando…</div>
        ) : (
          <div className="max-w-6xl grid grid-cols-1 xl:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] gap-6 items-start">
            <div className="bg-surface border border-border rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.06)] divide-y divide-border min-w-0">
              <section className="px-5 py-4 bg-surface-muted/30">
                <p className="text-sm text-fg-muted leading-relaxed">
                  Configurá cómo se leen las etiquetas de balanza (Kretz, Systel, Gemini). El cajero escanea el
                  código y el POS agrega el producto pesado automáticamente. Esta configuración se sincroniza a
                  los dispositivos POS.
                </p>
              </section>

              <section className="p-5 space-y-4">
                <h2 className="text-sm font-semibold text-fg">General</h2>
                <SettingSwitch
                  checked={cfg.enabled}
                  onCheckedChange={(v) => setCfg(c => ({ ...c, enabled: v }))}
                  label="Habilitar lectura de etiquetas de balanza"
                  description="Si está activo, el POS trata los códigos escaneados como etiquetas de balanza: busca el producto por PLU y agrega la línea con el peso o precio embebido. Si está apagado, el escáner solo busca SKU o código de barras normal."
                />
              </section>

              <section className="p-5 space-y-4">
                <h2 className="text-sm font-semibold text-fg">Formato del código</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <SettingSwitch
                  checked={cfg.validateCheckDigit}
                  onCheckedChange={(v) => setCfg(c => ({ ...c, validateCheckDigit: v }))}
                  label="Validar dígito verificador EAN-13"
                  description="Comprueba que el último dígito del código sea válido según el estándar EAN-13. Ayuda a descartar lecturas mal hechas por el escáner. Desactivalo solo si tu balanza no imprime EAN-13 estándar o los códigos válidos fallan en la prueba."
                />
              </section>

              <section className="p-5 space-y-3 bg-surface-muted/40">
                <h2 className="text-sm font-semibold text-fg">Probar código</h2>
                <Input
                  value={testCode}
                  onChange={(e) => {
                    setTestCode(e.target.value)
                    setActiveExample(null)
                  }}
                  placeholder="Pegá un código de balanza…"
                />
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(EXAMPLE_CODES) as [ExampleKey, (typeof EXAMPLE_CODES)[ExampleKey]][]).map(([key, ex]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setActiveExample(key)
                        setTestCode('')
                      }}
                      className={[
                        'inline-flex flex-col items-start rounded-sm border px-2.5 py-1.5 text-left transition-colors',
                        activeExample === key && !testCode.trim()
                          ? 'border-brand-600 bg-brand-50 text-fg'
                          : 'border-border bg-surface text-fg-muted hover:border-border-strong hover:bg-surface-hover',
                      ].join(' ')}
                    >
                      <span className="font-mono text-[12px] text-fg">{ex.code}</span>
                      <span className="text-[11px] text-fg-subtle">{ex.label}</span>
                    </button>
                  ))}
                </div>
                {effectiveCode && (
                  parsed ? (
                    <div className="rounded-sm border border-border bg-surface px-3 py-2.5 text-[13px] text-fg-muted space-y-1">
                      <div>PLU: <span className="font-mono text-fg">{parsed.pluCode}</span></div>
                      {parsed.weightKg != null && <div>Peso: <span className="font-mono text-fg">{parsed.weightKg} kg</span></div>}
                      {parsed.priceArs != null && <div>Precio: <span className="font-mono text-fg">$ {parsed.priceArs}</span></div>}
                    </div>
                  ) : (
                    <div className="text-[13px] text-danger">El código no coincide con esta configuración.</div>
                  )
                )}
              </section>
            </div>

            <aside className="min-w-0 xl:sticky xl:top-6">
              <BalanzaTutorialPanel />
            </aside>
          </div>
        )}
      </PageBody>
    </>
  )
}
