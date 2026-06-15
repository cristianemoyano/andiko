'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Textarea } from '@/components/primitives/Textarea'
import { FormField } from '@/components/primitives/FormField'
import { Select } from '@/components/primitives/Select'
import { Switch } from '@/components/primitives/Switch'
import { PrintDocumentRenderer } from '@/components/erp/print'
import { samplePrintableQuote } from '@/components/erp/print/print-document.fixture'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import type { PrintableDocument, PrintableTemplate } from '@/types/printing'

const FONT_OPTIONS = [
  { value: 'sans', label: 'Sans serif (moderna)' },
  { value: 'serif', label: 'Serif (clásica)' },
  { value: 'mono', label: 'Monoespaciada' },
]

const FONT_CSS: Record<string, string> = {
  sans: 'ui-sans-serif, system-ui, sans-serif',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
}

const SECTION_LABELS: Array<{ key: keyof FormState['sections']; label: string }> = [
  { key: 'logo', label: 'Logo' },
  { key: 'fiscal_block', label: 'Datos fiscales' },
  { key: 'branch', label: 'Sucursal' },
  { key: 'counterparty', label: 'Cliente / Proveedor' },
  { key: 'notes', label: 'Notas' },
  { key: 'footer', label: 'Pie de página' },
]

interface FormState {
  logo_url: string
  accent_color: string
  font_family: string
  footer_text: string
  show_cuit: boolean
  show_iva_condition: boolean
  show_fiscal_address: boolean
  sections: {
    logo: boolean
    fiscal_block: boolean
    branch: boolean
    counterparty: boolean
    notes: boolean
    footer: boolean
  }
}

interface FiscalData {
  legal_name: string | null
  cuit: string | null
  iva_condition_label: string | null
  fiscal_address: string | null
}

interface EffectiveResponse {
  template: {
    logo_url: string | null
    accent_color: string
    font_family: string
    footer_text: string | null
    show_cuit: boolean
    show_iva_condition: boolean
    show_fiscal_address: boolean
    sections: FormState['sections']
  }
  fiscal: FiscalData
  is_default: boolean
}

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

function toForm(t: EffectiveResponse['template']): FormState {
  return {
    logo_url: t.logo_url ?? '',
    accent_color: t.accent_color,
    font_family: t.font_family,
    footer_text: t.footer_text ?? '',
    show_cuit: t.show_cuit,
    show_iva_condition: t.show_iva_condition,
    show_fiscal_address: t.show_fiscal_address,
    sections: { ...t.sections },
  }
}

export function PrintTemplateTab() {
  const [form, setForm] = useState<FormState | null>(null)
  const [fiscal, setFiscal] = useState<FiscalData>({
    legal_name: null,
    cuit: null,
    iva_condition_label: null,
    fiscal_address: null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setServerError(null)
      try {
        const body = await fetchJson<EffectiveResponse>('/api/v1/printing/template')
        if (cancelled) return
        setForm(toForm(body.template))
        setFiscal(body.fiscal)
      } catch (e) {
        if (cancelled) return
        setServerError(getApiErrorMessage(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refresh])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => (f ? { ...f, [key]: value } : f))
    setSavedMsg(null)
  }

  function toggleSection(key: keyof FormState['sections'], value: boolean) {
    setForm(f => (f ? { ...f, sections: { ...f.sections, [key]: value } } : f))
    setSavedMsg(null)
  }

  function validate(f: FormState): Record<string, string> {
    const next: Record<string, string> = {}
    if (!HEX.test(f.accent_color)) next.accent_color = 'Color hexadecimal inválido (#rrggbb)'
    if (f.logo_url && !/^https?:\/\//.test(f.logo_url) && !/^data:image\//.test(f.logo_url)) {
      next.logo_url = 'Debe ser una URL http(s) o una imagen embebida (data:image)'
    }
    if (f.footer_text.length > 500) next.footer_text = 'Máximo 500 caracteres'
    return next
  }

  async function handleSave() {
    if (!form) return
    const v = validate(form)
    setErrors(v)
    if (Object.keys(v).length > 0) return

    setSaving(true)
    setServerError(null)
    setSavedMsg(null)
    try {
      await fetchJson('/api/v1/printing/template', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logo_url: form.logo_url.trim() || null,
          accent_color: form.accent_color,
          font_family: form.font_family,
          footer_text: form.footer_text.trim() || null,
          show_cuit: form.show_cuit,
          show_iva_condition: form.show_iva_condition,
          show_fiscal_address: form.show_fiscal_address,
          sections: form.sections,
        }),
      })
      setSavedMsg('Plantilla guardada.')
      setRefresh(r => r + 1)
    } catch (e) {
      setServerError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const previewDoc: PrintableDocument | null = useMemo(() => {
    if (!form) return null
    const template: PrintableTemplate = {
      logo_url: form.logo_url.trim() || null,
      accent_color: HEX.test(form.accent_color) ? form.accent_color : '#18181b',
      font_css: FONT_CSS[form.font_family] ?? FONT_CSS.sans,
      footer_text: form.footer_text.trim() || null,
      sections: { ...form.sections },
      show_cuit: form.show_cuit,
      show_iva_condition: form.show_iva_condition,
      show_fiscal_address: form.show_fiscal_address,
    }
    return {
      ...samplePrintableQuote,
      isDraft: false,
      issuer: {
        name: samplePrintableQuote.issuer.name,
        legal_name: fiscal.legal_name,
        cuit: form.show_cuit ? fiscal.cuit : null,
        iva_condition_label: form.show_iva_condition ? fiscal.iva_condition_label : null,
        fiscal_address: form.show_fiscal_address ? fiscal.fiscal_address : null,
      },
      template,
    }
  }, [form, fiscal])

  if (loading) return <p className="text-sm text-fg-muted">Cargando…</p>
  if (!form) return <p className="text-sm text-danger">{serverError ?? 'No se pudo cargar la configuración.'}</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[13px] text-fg-muted">
          Personalizá el encabezado, los colores y los datos visibles en presupuestos, pedidos, facturas y remitos impresos.
        </p>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        {/* Editor */}
        <div className="space-y-5">
          <section className="rounded-sm border border-border bg-surface p-4 space-y-4">
            <h2 className="text-sm font-semibold text-fg">Identidad visual</h2>

            <FormField label="URL del logo" htmlFor="logo_url" error={errors.logo_url}>
              <Input
                id="logo_url"
                value={form.logo_url}
                error={!!errors.logo_url}
                placeholder="https://… o data:image/png;base64,…"
                onChange={e => update('logo_url', e.target.value)}
              />
            </FormField>

            <FormField label="Color de acento" htmlFor="accent_color" error={errors.accent_color}>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Selector de color de acento"
                  value={HEX.test(form.accent_color) ? form.accent_color : '#18181b'}
                  onChange={e => update('accent_color', e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded-sm border border-border-strong bg-surface p-0.5"
                />
                <Input
                  id="accent_color"
                  value={form.accent_color}
                  error={!!errors.accent_color}
                  onChange={e => update('accent_color', e.target.value)}
                  className="font-mono"
                />
              </div>
            </FormField>

            <FormField label="Tipografía" htmlFor="font_family">
              <Select
                id="font_family"
                value={form.font_family}
                options={FONT_OPTIONS}
                onChange={v => update('font_family', v)}
              />
            </FormField>
          </section>

          <section className="rounded-sm border border-border bg-surface p-4 space-y-3">
            <h2 className="text-sm font-semibold text-fg">Datos fiscales</h2>
            <p className="text-xs text-fg-muted">
              Se toman de la organización. Activá u ocultá cada campo en los documentos.
            </p>
            <FiscalRow label="CUIT" value={fiscal.cuit} checked={form.show_cuit} onChange={v => update('show_cuit', v)} />
            <FiscalRow
              label="Condición IVA"
              value={fiscal.iva_condition_label}
              checked={form.show_iva_condition}
              onChange={v => update('show_iva_condition', v)}
            />
            <FiscalRow
              label="Domicilio"
              value={fiscal.fiscal_address}
              checked={form.show_fiscal_address}
              onChange={v => update('show_fiscal_address', v)}
            />
          </section>

          <section className="rounded-sm border border-border bg-surface p-4 space-y-3">
            <h2 className="text-sm font-semibold text-fg">Secciones visibles</h2>
            <div className="grid grid-cols-2 gap-y-2.5">
              {SECTION_LABELS.map(s => (
                <Switch
                  key={s.key}
                  label={s.label}
                  checked={form.sections[s.key]}
                  onCheckedChange={v => toggleSection(s.key, v)}
                />
              ))}
            </div>
          </section>

          <section className="rounded-sm border border-border bg-surface p-4 space-y-3">
            <h2 className="text-sm font-semibold text-fg">Pie de página</h2>
            <FormField label="Texto del pie" htmlFor="footer_text" error={errors.footer_text}>
              <Textarea
                id="footer_text"
                value={form.footer_text}
                error={!!errors.footer_text}
                rows={2}
                placeholder="Ej: Documento no válido como factura. Gracias por su compra."
                onChange={e => update('footer_text', e.target.value)}
              />
            </FormField>
          </section>

          {serverError ? <p className="text-sm text-danger">{serverError}</p> : null}
          {savedMsg ? <p className="text-sm text-success">{savedMsg}</p> : null}
        </div>

        {/* Live preview */}
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">Vista previa</p>
          <div className="overflow-hidden rounded-sm border border-border bg-surface-hover p-4">
            <div className="origin-top scale-[0.78] [&>div]:shadow-none">
              {previewDoc ? <PrintDocumentRenderer document={previewDoc} /> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FiscalRow({
  label,
  value,
  checked,
  onChange,
}: {
  label: string
  value: string | null
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[13px] text-fg-muted">{label}</p>
        <p className="truncate text-xs text-fg-subtle">{value ?? 'Sin configurar en la organización'}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={`Mostrar ${label}`} />
    </div>
  )
}
