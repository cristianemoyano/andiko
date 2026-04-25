'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/primitives/Button'
import { parseCsvText } from '@/lib/csv'
import type { CsvHeader } from '@/lib/csv'

export type ImportAction = 'create' | 'update' | 'upsert'

export type ImportResult = {
  created: number
  updated: number
  skipped: number
  errors: { row: number; message: string }[]
}

export interface ImportModalProps {
  open: boolean
  onClose: () => void
  /** Display title, e.g. "Importar contactos" */
  title: string
  /** Expected fields for this module */
  fields: CsvHeader[]
  /** Required field keys — mapping must include these */
  requiredFields?: string[]
  /** POST endpoint URL, e.g. /api/v1/contacts/import */
  importUrl: string
  /** Called after a successful import (no errors) */
  onImported?: (result: ImportResult) => void
}

type Step = 'upload' | 'mapping' | 'confirm' | 'result'
const ACTION_LABELS: Record<ImportAction, string> = {
  create: 'Solo crear nuevos',
  update: 'Solo actualizar existentes',
  upsert: 'Crear y actualizar (upsert)',
}

const IGNORE = '__ignore__'

export function ImportModal({
  open,
  onClose,
  title,
  fields,
  requiredFields = [],
  importUrl,
  onImported,
}: ImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep]           = useState<Step>('upload')
  const [file, setFile]           = useState<File | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [rowCount, setRowCount]   = useState(0)
  const [mapping, setMapping]     = useState<Record<string, string>>({})
  const [action, setAction]       = useState<ImportAction>('upsert')
  const [mappingErrors, setMappingErrors] = useState<Record<string, string>>({})
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState<ImportResult | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  /** Lleva el asistente al paso inicial (archivo). No notifica al padre. */
  const resetWizard = useCallback(() => {
    setStep('upload')
    setFile(null)
    setCsvHeaders([])
    setRowCount(0)
    setMapping({})
    setMappingErrors({})
    setResult(null)
    setServerError(null)
    setLoading(false)
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  const handleClose = useCallback(() => {
    resetWizard()
    onClose()
  }, [onClose, resetWizard])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, handleClose])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const { headers, rows } = parseCsvText(text)
      setCsvHeaders(headers)
      setRowCount(rows.length)

      // Auto-map: match by exact label or by key (case-insensitive)
      const autoMap: Record<string, string> = {}
      for (const field of fields) {
        const match = headers.find(h =>
          h.toLowerCase() === field.label.toLowerCase() ||
          h.toLowerCase() === field.key.toLowerCase()
        )
        autoMap[field.key] = match ?? IGNORE
      }
      setMapping(autoMap)
      setStep('mapping')
    }
    reader.readAsText(f)
  }

  function validateMapping(): boolean {
    const errs: Record<string, string> = {}
    for (const key of requiredFields) {
      if (!mapping[key] || mapping[key] === IGNORE) {
        errs[key] = 'Campo requerido'
      }
    }
    setMappingErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    if (!file) return
    setLoading(true)
    setServerError(null)

    const effectiveMapping: Record<string, string> = {}
    for (const [key, col] of Object.entries(mapping)) {
      if (col && col !== IGNORE) effectiveMapping[key] = col
    }

    const fd = new FormData()
    fd.append('file', file)
    fd.append('action', action)
    fd.append('mapping', JSON.stringify(effectiveMapping))

    try {
      const res = await fetch(importUrl, { method: 'POST', body: fd, credentials: 'same-origin' })
      const data = await res.json() as ImportResult & { error?: string }
      if (!res.ok) {
        setServerError(data.error ?? 'Error al importar')
        if (data.errors?.length) {
          setResult(data)
          setStep('result')
        }
      } else {
        setResult(data)
        setStep('result')
        if (data.errors.length === 0) onImported?.(data)
      }
    } catch {
      setServerError('Error de red al importar')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const mappedCount = Object.values(mapping).filter(v => v && v !== IGNORE).length

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div
        className="absolute inset-0 bg-black/50 animate-in fade-in duration-200"
        aria-hidden
        onClick={handleClose}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto flex w-full max-w-lg max-h-[90vh] flex-col rounded-md border border-zinc-200 bg-white shadow-2xl ring-1 ring-black/5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-modal-title"
          onClick={e => e.stopPropagation()}
        >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200">
        <h2 id="import-modal-title" className="text-sm font-semibold text-zinc-900">{title}</h2>
        <button
          className="text-zinc-400 hover:text-zinc-700 text-lg leading-none"
          onClick={handleClose}
          aria-label="Cerrar"
        >
          ×
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex gap-0 border-b border-zinc-100 bg-zinc-50 px-5 py-2">
        {(['upload', 'mapping', 'confirm', 'result'] as Step[]).map((s, idx) => {
          const labels: Record<Step, string> = { upload: '1. Archivo', mapping: '2. Columnas', confirm: '3. Acción', result: '4. Resultado' }
          const active = s === step
          const done   = ['upload', 'mapping', 'confirm', 'result'].indexOf(step) > idx
          return (
            <span
              key={s}
              className={`text-[11px] px-3 py-1 rounded-sm font-medium ${
                active ? 'text-brand-700 bg-brand-50' : done ? 'text-zinc-500' : 'text-zinc-300'
              }`}
            >
              {labels[s]}
            </span>
          )
        })}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 text-sm text-zinc-800">
        {step === 'upload' && (
          <div className="flex flex-col gap-3">
            <p className="text-zinc-500 text-[13px]">
              Seleccioná un archivo <strong>.csv</strong>. El orden de las columnas no importa — en el siguiente paso podés mapearlas.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="text-[13px] text-zinc-700 file:mr-3 file:py-1 file:px-3 file:rounded file:border file:border-zinc-300 file:text-[12px] file:bg-white file:cursor-pointer hover:file:bg-zinc-50"
            />
          </div>
        )}

        {step === 'mapping' && (
          <div className="flex flex-col gap-3">
            <p className="text-zinc-500 text-[13px]">
              Asigná cada campo del sistema a la columna correspondiente de tu CSV ({csvHeaders.length} columnas detectadas).
            </p>
            <div className="divide-y divide-zinc-100 border border-zinc-200 rounded">
              {fields.map(field => (
                <div key={field.key} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-36 text-[12px] font-medium text-zinc-700 shrink-0">
                    {field.label}
                    {requiredFields.includes(field.key) && (
                      <span className="text-red-500 ml-0.5">*</span>
                    )}
                  </span>
                  <select
                    value={mapping[field.key] ?? IGNORE}
                    onChange={e => {
                      setMapping(m => ({ ...m, [field.key]: e.target.value }))
                      if (mappingErrors[field.key]) {
                        setMappingErrors(err => { const next = { ...err }; delete next[field.key]; return next })
                      }
                    }}
                    className={`flex-1 h-7 text-[12px] border rounded-sm px-2 bg-white focus:outline-none focus:border-blue-400 ${
                      mappingErrors[field.key] ? 'border-red-400' : 'border-zinc-300'
                    }`}
                  >
                    <option value={IGNORE}>— Ignorar —</option>
                    {csvHeaders.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  {mappingErrors[field.key] && (
                    <span className="text-[11px] text-red-600 shrink-0">{mappingErrors[field.key]}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="flex flex-col gap-4">
            <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3 text-[13px] text-zinc-700 space-y-1">
              <div><span className="font-medium">Archivo:</span> {file?.name}</div>
              <div><span className="font-medium">Filas:</span> {rowCount}</div>
              <div><span className="font-medium">Campos mapeados:</span> {mappedCount} de {fields.length}</div>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-zinc-700 mb-1">Acción ante registros existentes</label>
              <select
                value={action}
                onChange={e => setAction(e.target.value as ImportAction)}
                className="w-full h-8 text-[13px] border border-zinc-300 rounded-sm px-2 bg-white focus:outline-none focus:border-blue-400"
              >
                {(Object.entries(ACTION_LABELS) as [ImportAction, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            {serverError && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
                {serverError}
              </div>
            )}
          </div>
        )}

        {step === 'result' && result && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Creados',   value: result.created, color: 'text-green-700 bg-green-50 border-green-200' },
                { label: 'Actualizados', value: result.updated, color: 'text-blue-700 bg-blue-50 border-blue-200' },
                { label: 'Omitidos',  value: result.skipped, color: 'text-zinc-600 bg-zinc-50 border-zinc-200' },
              ].map(({ label, value, color }) => (
                <div key={label} className={`rounded border px-2 py-3 ${color}`}>
                  <div className="text-xl font-semibold">{value}</div>
                  <div className="text-[11px] font-medium mt-0.5">{label}</div>
                </div>
              ))}
            </div>
            {result.errors.length > 0 && (
              <div>
                <p className="text-[12px] font-medium text-red-700 mb-1.5">
                  {result.errors.length} fila{result.errors.length !== 1 ? 's' : ''} con error — no se importó ningún registro
                </p>
                <div className="max-h-48 overflow-y-auto border border-red-200 rounded text-[12px]">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-red-50">
                        <th className="px-3 py-1.5 text-left font-semibold text-red-700 w-16">Fila</th>
                        <th className="px-3 py-1.5 text-left font-semibold text-red-700">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((err, idx) => (
                        <tr key={idx} className="border-t border-red-100">
                          <td className="px-3 py-1.5 text-zinc-600">{err.row}</td>
                          <td className="px-3 py-1.5 text-zinc-800">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-100 bg-zinc-50">
        <Button variant="secondary" size="sm" onClick={handleClose}>
          {step === 'result' ? 'Cerrar' : 'Cancelar'}
        </Button>
        <div className="flex gap-2">
          {step === 'mapping' && (
            <Button variant="secondary" size="sm" onClick={() => setStep('upload')}>Atrás</Button>
          )}
          {step === 'confirm' && (
            <Button variant="secondary" size="sm" onClick={() => setStep('mapping')}>Atrás</Button>
          )}
          {step === 'mapping' && (
            <Button size="sm" onClick={() => { if (validateMapping()) setStep('confirm') }}>
              Siguiente
            </Button>
          )}
          {step === 'confirm' && (
            <Button size="sm" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Importando…' : 'Importar'}
            </Button>
          )}
          {step === 'result' && result && result.errors.length === 0 && (
            <Button size="sm" onClick={handleClose}>Listo</Button>
          )}
          {step === 'result' && result && result.errors.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setStep('confirm')}>Reintentar</Button>
          )}
        </div>
      </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
