'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Textarea } from '@/components/primitives/Textarea'
import { FormField } from '@/components/primitives/FormField'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/layout/Tabs'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

type DocType = 'quote' | 'order' | 'invoice' | 'delivery_note'
const DOC_TYPES: DocType[] = ['quote', 'order', 'invoice', 'delivery_note']

interface TemplateEntry {
  subject: string
  body: string
}
type Templates = Record<DocType, TemplateEntry>

interface TemplatesResponse {
  templates: Templates
  defaults: Templates
  labels: Record<DocType, string>
  variables: string[]
}

export function EmailTemplatesTab() {
  const [templates, setTemplates] = useState<Templates | null>(null)
  const [defaults, setDefaults] = useState<Templates | null>(null)
  const [labels, setLabels] = useState<Record<DocType, string>>({
    quote: 'Presupuesto',
    order: 'Pedido',
    invoice: 'Factura',
    delivery_note: 'Remito',
  })
  const [variables, setVariables] = useState<string[]>([])
  const [active, setActive] = useState<DocType>('quote')
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
        const body = await fetchJson<TemplatesResponse>('/api/v1/communications/templates')
        if (cancelled) return
        setTemplates(body.templates)
        setDefaults(body.defaults)
        setLabels(body.labels)
        setVariables(body.variables)
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

  function update(type: DocType, key: keyof TemplateEntry, value: string) {
    setTemplates(t => (t ? { ...t, [type]: { ...t[type], [key]: value } } : t))
    setSavedMsg(null)
  }

  function resetToDefault(type: DocType) {
    if (!defaults) return
    setTemplates(t => (t ? { ...t, [type]: { ...defaults[type] } } : t))
    setSavedMsg(null)
  }

  function validate(t: Templates): Record<string, string> {
    const next: Record<string, string> = {}
    for (const type of DOC_TYPES) {
      if (!t[type].subject.trim()) next[`${type}.subject`] = 'El asunto es obligatorio'
      if (!t[type].body.trim()) next[`${type}.body`] = 'El cuerpo es obligatorio'
    }
    return next
  }

  async function handleSave() {
    if (!templates) return
    const v = validate(templates)
    setErrors(v)
    if (Object.keys(v).length > 0) return

    setSaving(true)
    setServerError(null)
    setSavedMsg(null)
    try {
      const body = await fetchJson<{ templates: Templates }>('/api/v1/communications/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templates),
      })
      setTemplates(body.templates)
      setSavedMsg('Plantillas guardadas.')
      setRefresh(r => r + 1)
    } catch (e) {
      setServerError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-zinc-500">Cargando…</p>
  if (!templates) return <p className="text-sm text-red-700">{serverError ?? 'No se pudieron cargar las plantillas.'}</p>

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-[13px] text-zinc-500">
          Definí el asunto y el cuerpo del email para cada tipo de documento. Usá variables como{' '}
          <code className="rounded-sm bg-zinc-100 px-1 py-0.5 text-[12px]">{'{{contact_name}}'}</code> para
          personalizar el mensaje.
        </p>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>

      <Tabs value={active} onValueChange={v => setActive(v as DocType)}>
        <TabsList>
          {DOC_TYPES.map(type => (
            <TabsTrigger key={type} value={type}>
              {labels[type]}
            </TabsTrigger>
          ))}
        </TabsList>

        {DOC_TYPES.map(type => (
          <TabsContent key={type} value={type}>
            <div className="space-y-4 rounded-sm border border-zinc-200 bg-white p-4">
              <FormField label="Asunto" htmlFor={`${type}-subject`} error={errors[`${type}.subject`]}>
                <Input
                  id={`${type}-subject`}
                  value={templates[type].subject}
                  error={!!errors[`${type}.subject`]}
                  onChange={e => update(type, 'subject', e.target.value)}
                />
              </FormField>

              <FormField label="Cuerpo" htmlFor={`${type}-body`} error={errors[`${type}.body`]}>
                <Textarea
                  id={`${type}-body`}
                  value={templates[type].body}
                  error={!!errors[`${type}.body`]}
                  rows={12}
                  className="font-mono text-[13px]"
                  onChange={e => update(type, 'body', e.target.value)}
                />
              </FormField>

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-zinc-400">
                  Variables: {variables.map(v => `{{${v}}}`).join(', ')}
                </p>
                <Button type="button" variant="ghost" size="sm" onClick={() => resetToDefault(type)}>
                  Restaurar predeterminado
                </Button>
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {serverError ? <p className="text-sm text-red-700">{serverError}</p> : null}
      {savedMsg ? <p className="text-sm text-green-700">{savedMsg}</p> : null}
    </div>
  )
}
