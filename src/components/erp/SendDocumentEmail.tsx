'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Textarea } from '@/components/primitives/Textarea'
import { FormField } from '@/components/primitives/FormField'
import { Dialog } from '@/components/primitives/Dialog'
import { DropdownMenuItem } from '@/components/primitives/DropdownMenu'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

export type EmailDocumentType = 'quote' | 'order' | 'invoice' | 'delivery_note'

interface TemplateEntry {
  subject: string
  body: string
}

interface EmailLogView {
  id: string
  recipient: string
  subject: string
  status: 'sent' | 'failed'
  error: string | null
  sent_at: string
}

interface SendResult {
  status: 'sent' | 'failed'
  transport: 'smtp' | 'log'
  recipient: string
}

interface Props {
  documentType: EmailDocumentType
  documentId: string
  /** e.g. "Factura FAC-0001" — used in the dialog title. */
  documentLabel: string
  /** Prefilled recipient, typically the linked contact's email. */
  defaultEmail?: string | null
  buttonVariant?: 'primary' | 'secondary' | 'ghost'
  buttonSize?: 'sm' | 'md' | 'lg'
  /** When `menu-item`, renders inside a PageActionBar dropdown instead of a standalone button. */
  triggerMode?: 'button' | 'menu-item'
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function formatDate(iso: string): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function SendDocumentEmail({
  documentType,
  documentId,
  documentLabel,
  defaultEmail,
  buttonVariant = 'ghost',
  buttonSize = 'sm',
  triggerMode = 'button',
}: Props) {
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [logs, setLogs] = useState<EmailLogView[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [result, setResult] = useState<SendResult | null>(null)
  const [refresh, setRefresh] = useState(0)

  const loadLogs = useCallback(async () => {
    const params = new URLSearchParams({ document_type: documentType, document_id: documentId })
    const body = await fetchJson<{ logs: EmailLogView[] }>(`/api/v1/communications/logs?${params}`)
    return body.logs
  }, [documentType, documentId])

  // On open, prefill the compose fields from the org template and load history.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setServerError(null)
      setResult(null)
      try {
        const [tplRes, logList] = await Promise.all([
          fetchJson<{ templates: Record<EmailDocumentType, TemplateEntry> }>('/api/v1/communications/templates'),
          loadLogs(),
        ])
        if (cancelled) return
        const tpl = tplRes.templates[documentType]
        setSubject(tpl.subject)
        setBody(tpl.body)
        setTo(defaultEmail ?? '')
        setLogs(logList)
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
    // refresh re-runs after a successful send to refetch history.
  }, [open, documentType, defaultEmail, loadLogs, refresh])

  async function handleSend() {
    const v: Record<string, string> = {}
    if (!EMAIL.test(to.trim())) v.to = 'Dirección de correo inválida'
    if (!subject.trim()) v.subject = 'El asunto es obligatorio'
    if (!body.trim()) v.body = 'El cuerpo es obligatorio'
    setErrors(v)
    if (Object.keys(v).length > 0) return

    setSending(true)
    setServerError(null)
    setResult(null)
    try {
      const res = await fetchJson<SendResult>('/api/v1/communications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_type: documentType,
          document_id: documentId,
          to: to.trim(),
          subject: subject.trim(),
          body,
        }),
      })
      setResult(res)
      setRefresh(r => r + 1)
    } catch (e) {
      setServerError(getApiErrorMessage(e))
      setRefresh(r => r + 1) // a failed send is still logged
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {triggerMode === 'menu-item' ? (
        <DropdownMenuItem onSelect={() => setOpen(true)}>
          Enviar por email
        </DropdownMenuItem>
      ) : (
        <Button type="button" variant={buttonVariant} size={buttonSize} onClick={() => setOpen(true)}>
          Enviar por email
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
        size="lg"
        title={`Enviar ${documentLabel} por email`}
        description="Las variables ({{contact_name}}, {{total}}, …) se completan automáticamente al enviar."
      >
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-4">
          {loading ? (
            <p className="text-sm text-fg-muted">Cargando…</p>
          ) : (
            <>
              <FormField label="Para" htmlFor="email-to" error={errors.to}>
                <Input
                  id="email-to"
                  value={to}
                  error={!!errors.to}
                  placeholder="cliente@dominio.com"
                  onChange={e => setTo(e.target.value)}
                />
              </FormField>

              <FormField label="Asunto" htmlFor="email-subject" error={errors.subject}>
                <Input
                  id="email-subject"
                  value={subject}
                  error={!!errors.subject}
                  onChange={e => setSubject(e.target.value)}
                />
              </FormField>

              <FormField label="Mensaje" htmlFor="email-body" error={errors.body}>
                <Textarea
                  id="email-body"
                  value={body}
                  error={!!errors.body}
                  rows={10}
                  className="font-mono text-[13px]"
                  onChange={e => setBody(e.target.value)}
                />
              </FormField>

              {serverError ? <p className="text-sm text-danger">{serverError}</p> : null}
              {result ? (
                result.transport === 'log' ? (
                  <p className="text-sm text-warning">
                    Email registrado pero no entregado: configurá el servidor SMTP en Configuración → Email para
                    enviarlo realmente.
                  </p>
                ) : (
                  <p className="text-sm text-success">Email enviado a {result.recipient}.</p>
                )
              ) : null}

              {/* Send history */}
              <div className="border-t border-border pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-fg-muted mb-2">
                  Historial de envíos
                </p>
                {logs.length === 0 ? (
                  <p className="text-[13px] text-fg-subtle">Todavía no se envió este documento por email.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {logs.map(log => (
                      <li key={log.id} className="flex items-start justify-between gap-3 text-[13px]">
                        <div className="min-w-0">
                          <span className="text-fg">{log.recipient}</span>
                          {log.error ? <p className="truncate text-xs text-danger">{log.error}</p> : null}
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                          <span
                            className={
                              log.status === 'sent'
                                ? 'rounded-sm bg-success-bg px-1.5 py-0.5 text-[11px] font-medium text-success'
                                : 'rounded-sm bg-danger-bg px-1.5 py-0.5 text-[11px] font-medium text-danger'
                            }
                          >
                            {log.status === 'sent' ? 'Enviado' : 'Falló'}
                          </span>
                          <span className="text-xs text-fg-subtle">{formatDate(log.sent_at)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
          <Button type="button" size="sm" onClick={handleSend} disabled={sending || loading}>
            {sending ? 'Enviando…' : 'Enviar'}
          </Button>
        </div>
      </Dialog>
    </>
  )
}
