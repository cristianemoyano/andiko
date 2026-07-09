'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/primitives/Button'
import { parseCsvText } from '@/lib/csv'
import type { CsvHeader } from '@/lib/csv'
import { formatImportEtaRemaining, readImportStream } from '@/lib/import-progress'

export type ImportAction = 'create' | 'update' | 'upsert'

export type ImportResult = {
  created: number
  updated: number
  skipped: number
  errors: { row: number; message: string }[]
}

/** Campos opcionales con valor por defecto cuando la celda del CSV viene vacía (solo import de catálogo u otros que lo configuren). */
export type ImportDefaultFieldConfig = {
  key: string
  label: string
  description?: string
  inputKind: 'text' | 'select'
  options?: { value: string; label: string }[]
  placeholder?: string
  /** Valor inicial en el formulario de defaults (p. ej. gestionar stock = sí). */
  defaultValue?: string
}

/** Depósito destino al importar catálogo con inventario activo. */
export type ImportStockWarehouseConfig = {
  label?: string
  description?: string
  options: { value: string; label: string }[]
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
  /** Called after a successful import (no errors). Incluye el mapeo efectivo (CSV column → clave interna invertida: clave → columna). */
  onImported?: (result: ImportResult, effectiveMapping?: Record<string, string>) => void
  /** Mapas guardados (p. ej. desde GET import-field-maps) para pre-llenar columnas */
  savedFieldMaps?: Array<{ external_header: string; internal_field_key: string }>
  /** Valor de `import_source` en el servidor (correlación de origen) */
  importSource?: string
  /**
   * Valores por defecto por campo interno si la celda mapeada está vacía.
   * El servidor solo aplica claves válidas para ese módulo (p. ej. allowlist de catálogo).
   */
  defaultFillFields?: ImportDefaultFieldConfig[]
  /** Si true, pide progreso en tiempo real vía NDJSON (`stream=1`). */
  supportsStreamProgress?: boolean
  /** Depósito destino cuando se mapea stock (catálogo + inventario activo). */
  stockWarehouse?: ImportStockWarehouseConfig
  /** Oculta el selector crear/actualizar/upsert (p. ej. import de stock en depósito). */
  hideActionSelect?: boolean
  /** Texto bajo el resumen en el paso de confirmación. */
  confirmHint?: string
}

type Step = 'upload' | 'mapping' | 'confirm' | 'importing' | 'result'
const ACTION_LABELS: Record<ImportAction, string> = {
  create: 'Solo crear nuevos',
  update: 'Solo actualizar existentes',
  upsert: 'Crear y actualizar (upsert)',
}

const IGNORE = '__ignore__'

const SAMPLE_PREVIEW_LEN = 120
const SAMPLE_CELL_CAP = 4000
const SAMPLE_SCAN_ROWS = 80

type ColumnSample = { preview: string; full: string }

/** Primera celda no vacía por encabezado (primeras filas) para previsualizar el mapeo. */
function buildColumnSamples(headers: string[], rows: Record<string, string>[]): Record<string, ColumnSample> {
  const out: Record<string, ColumnSample> = {}
  const limit = Math.min(rows.length, SAMPLE_SCAN_ROWS)
  for (const h of headers) {
    let full = ''
    for (let i = 0; i < limit; i++) {
      const v = (rows[i]?.[h] ?? '').trim()
      if (v) {
        full = v.length > SAMPLE_CELL_CAP ? `${v.slice(0, SAMPLE_CELL_CAP)}…` : v
        break
      }
    }
    const preview =
      full.length > SAMPLE_PREVIEW_LEN ? `${full.slice(0, SAMPLE_PREVIEW_LEN)}…` : full
    out[h] = { preview, full }
  }
  return out
}

export function ImportModal({
  open,
  onClose,
  title,
  fields,
  requiredFields = [],
  importUrl,
  onImported,
  savedFieldMaps = [],
  importSource = 'catalog_csv',
  defaultFillFields = [],
  supportsStreamProgress = false,
  stockWarehouse,
  hideActionSelect = false,
  confirmHint,
}: ImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep]           = useState<Step>('upload')
  const [file, setFile]           = useState<File | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  /** Valor de ejemplo por nombre de columna del CSV (primera celda no vacía). */
  const [csvColumnSamples, setCsvColumnSamples] = useState<Record<string, ColumnSample>>({})
  const [rowCount, setRowCount]   = useState(0)
  const [mapping, setMapping]     = useState<Record<string, string>>({})
  const [action, setAction]       = useState<ImportAction>('upsert')
  const [mappingErrors, setMappingErrors] = useState<Record<string, string>>({})
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState<ImportResult | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  /** Valores por defecto cuando la celda CSV está vacía (claves según defaultFillFields). */
  const [fillDefaults, setFillDefaults] = useState<Record<string, string>>({})
  const [stockWarehouseId, setStockWarehouseId] = useState('')
  const [stockWarehouseError, setStockWarehouseError] = useState<string | null>(null)
  const [importProgress, setImportProgress] = useState<{ processed: number; total: number } | null>(null)
  const [progressEta, setProgressEta] = useState<string | null>(null)
  const importEstimateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /** Lleva el asistente al paso inicial (archivo). No notifica al padre. */
  const resetWizard = useCallback(() => {
    setStep('upload')
    setFile(null)
    setCsvHeaders([])
    setCsvColumnSamples({})
    setRowCount(0)
    setMapping({})
    setMappingErrors({})
    setFillDefaults({})
    setStockWarehouseId('')
    setStockWarehouseError(null)
    setImportProgress(null)
    setProgressEta(null)
    if (importEstimateTimerRef.current) {
      clearInterval(importEstimateTimerRef.current)
      importEstimateTimerRef.current = null
    }
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
      setCsvColumnSamples(buildColumnSamples(headers, rows))
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
      for (const row of savedFieldMaps) {
        if (!headers.includes(row.external_header)) continue
        if (!fields.some((f) => f.key === row.internal_field_key)) continue
        autoMap[row.internal_field_key] = row.external_header
      }
      setMapping(autoMap)
      if (defaultFillFields.length > 0) {
        const init: Record<string, string> = {}
        for (const f of defaultFillFields) init[f.key] = f.defaultValue ?? ''
        setFillDefaults(init)
      } else {
        setFillDefaults({})
      }
      setStep('mapping')
    }
    reader.readAsText(f)
  }

  const stockWarehouseOptions = stockWarehouse?.options ?? []
  const showStockWarehousePicker = Boolean(stockWarehouse)
  const stockWarehouseRequired = stockWarehouseOptions.length > 0

  function validateStockWarehouse(): boolean {
    if (!stockWarehouseRequired) {
      setStockWarehouseError(null)
      return true
    }
    if (!stockWarehouseId.trim()) {
      setStockWarehouseError('Elegí el depósito donde cargar el stock.')
      return false
    }
    setStockWarehouseError(null)
    return true
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

  function validateConfirm(): boolean {
    return validateStockWarehouse()
  }

  function stopImportEstimateTimer() {
    if (importEstimateTimerRef.current) {
      clearInterval(importEstimateTimerRef.current)
      importEstimateTimerRef.current = null
    }
  }

  function updateImportProgress(processed: number, total: number, startedAt: number | null) {
    setImportProgress({ processed, total })
    if (startedAt != null) {
      setProgressEta(formatImportEtaRemaining(processed, total, Date.now() - startedAt))
    }
  }

  function startImportEstimateTimer(total: number): number {
    stopImportEstimateTimer()
    const startedAt = Date.now()
    updateImportProgress(0, total, startedAt)
    if (supportsStreamProgress) return startedAt
    importEstimateTimerRef.current = setInterval(() => {
      setImportProgress((prev) => {
        if (!prev) return prev
        const elapsed = Date.now() - startedAt
        const estimatedMsPerRow = Math.max(elapsed / Math.max(prev.total, 1), 8)
        const estimatedProcessed = Math.min(
          prev.total - 1,
          Math.floor(elapsed / estimatedMsPerRow),
        )
        setProgressEta(formatImportEtaRemaining(estimatedProcessed, prev.total, elapsed))
        return { processed: estimatedProcessed, total: prev.total }
      })
    }, 400)
    return startedAt
  }

  async function handleSubmit() {
    if (!file) return
    if (!validateConfirm()) return
    setLoading(true)
    setServerError(null)
    setStep('importing')
    const importStartedAtMs = startImportEstimateTimer(rowCount)

    const effectiveMapping: Record<string, string> = {}
    for (const [key, col] of Object.entries(mapping)) {
      if (col && col !== IGNORE) effectiveMapping[key] = col
    }

    const defaultsPayload: Record<string, string> = {}
    for (const f of defaultFillFields) {
      const v = (fillDefaults[f.key] ?? '').trim()
      if (v) defaultsPayload[f.key] = v
    }

    const fd = new FormData()
    fd.append('file', file)
    if (!hideActionSelect) {
      fd.append('action', action)
    } else {
      fd.append('action', 'upsert')
    }
    fd.append('mapping', JSON.stringify(effectiveMapping))
    if (importSource.trim()) fd.append('import_source', importSource.trim())
    if (Object.keys(defaultsPayload).length > 0) {
      fd.append('import_defaults', JSON.stringify(defaultsPayload))
    }
    if (stockWarehouseId.trim()) {
      fd.append('import_warehouse_id', stockWarehouseId.trim())
    }
    if (supportsStreamProgress) fd.append('stream', '1')

    try {
      const res = await fetch(importUrl, { method: 'POST', body: fd, credentials: 'same-origin' })

      if (supportsStreamProgress && res.ok && res.headers.get('content-type')?.includes('application/x-ndjson')) {
        const streamResult = await readImportStream(res, (processed, total) => {
          updateImportProgress(processed, total, importStartedAtMs)
        })
        const data = streamResult
        updateImportProgress(rowCount, rowCount, importStartedAtMs)
        setResult(data)
        setStep('result')
        if (data.errors.length === 0) onImported?.(data, effectiveMapping)
        return
      }

      const data = await res.json() as ImportResult & { error?: string }
      setImportProgress({ processed: rowCount, total: rowCount })
      if (!res.ok) {
        setServerError(data.error ?? 'Error al importar')
        if (data.errors?.length) {
          setResult(data)
          setStep('result')
        } else {
          setStep('confirm')
        }
      } else {
        setResult(data)
        setStep('result')
        if (data.errors.length === 0) onImported?.(data, effectiveMapping)
      }
    } catch (err) {
      const importErrors = (err as Error & { importErrors?: ImportResult['errors'] }).importErrors
      if (importErrors?.length) {
        setResult({ created: 0, updated: 0, skipped: 0, errors: importErrors })
        setStep('result')
      } else if (err instanceof Error && err.message.startsWith('IMPORT_STREAM')) {
        setServerError('No se pudo leer el progreso de la importación')
        setStep('confirm')
      } else {
        setServerError(err instanceof Error ? err.message : 'Error de red al importar')
        setStep('confirm')
      }
    } finally {
      stopImportEstimateTimer()
      setLoading(false)
    }
  }

  if (!open) return null

  const mappedCount = Object.values(mapping).filter(v => v && v !== IGNORE).length
  const progressPct = importProgress && importProgress.total > 0
    ? Math.min(100, Math.round((importProgress.processed / importProgress.total) * 100))
    : 0
  const stepOrder: Step[] = ['upload', 'mapping', 'confirm', 'importing', 'result']

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div
        className="absolute inset-0 bg-black/50 animate-in fade-in duration-200"
        aria-hidden
        onClick={handleClose}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto flex w-full max-w-xl max-h-[90vh] flex-col rounded-md border border-border bg-surface shadow-2xl ring-1 ring-black/5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-modal-title"
          onClick={e => e.stopPropagation()}
        >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <h2 id="import-modal-title" className="text-sm font-semibold text-fg">{title}</h2>
        <button
          className="text-fg-subtle hover:text-fg-muted text-lg leading-none"
          onClick={handleClose}
          aria-label="Cerrar"
        >
          ×
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex gap-0 border-b border-border bg-surface-muted px-5 py-2">
        {stepOrder.map((s, idx) => {
          const labels: Record<Step, string> = {
            upload: '1. Archivo',
            mapping: '2. Columnas',
            confirm: '3. Acción',
            importing: '4. Importando',
            result: '5. Resultado',
          }
          const active = s === step
          const done = stepOrder.indexOf(step) > idx
          return (
            <span
              key={s}
              className={`text-[11px] px-3 py-1 rounded-sm font-medium ${
                active ? 'text-brand-accent bg-brand-accent-bg' : done ? 'text-fg-muted' : 'text-fg-subtle'
              }`}
            >
              {labels[s]}
            </span>
          )
        })}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 text-sm text-fg">
        {step === 'upload' && (
          <div className="flex flex-col gap-3">
            <p className="text-fg-muted text-[13px]">
              Seleccioná un archivo <strong>.csv</strong>. El orden de las columnas no importa — en el siguiente paso podés mapearlas.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="text-[13px] text-fg-muted file:mr-3 file:py-1 file:px-3 file:rounded file:border file:border-border-strong file:text-[12px] file:bg-surface file:cursor-pointer hover:file:bg-surface-muted"
            />
          </div>
        )}

        {step === 'mapping' && (
          <div className="flex flex-col gap-3">
            <p className="text-fg-muted text-[13px]">
              Asigná cada campo del sistema a la columna correspondiente de tu CSV ({csvHeaders.length} columnas detectadas).
              Las columnas que no mapees se conservan en el servidor vinculadas al producto o a la fila de origen, para no perder datos.
            </p>
            <div className="divide-y divide-border border border-border rounded">
              {fields.map((field) => {
                const col = mapping[field.key] ?? IGNORE
                const sample = col !== IGNORE ? csvColumnSamples[col] : undefined
                return (
                <div key={field.key} className="flex items-start gap-3 px-3 py-2">
                  <span className="w-36 text-[12px] font-medium text-fg-muted shrink-0 pt-1">
                    {field.label}
                    {requiredFields.includes(field.key) && (
                      <span className="text-danger ml-0.5">*</span>
                    )}
                  </span>
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <select
                      value={col}
                      onChange={e => {
                        setMapping(m => ({ ...m, [field.key]: e.target.value }))
                        if (mappingErrors[field.key]) {
                          setMappingErrors(err => { const next = { ...err }; delete next[field.key]; return next })
                        }
                      }}
                      className={`w-full h-7 text-[12px] border rounded-sm px-2 bg-surface focus:outline-none focus:border-ring ${
                        mappingErrors[field.key] ? 'border-danger' : 'border-border-strong'
                      }`}
                      aria-describedby={col !== IGNORE ? `import-map-sample-${field.key}` : undefined}
                    >
                      <option value={IGNORE}>— Ignorar —</option>
                      {csvHeaders.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    {col !== IGNORE && (
                      <p
                        id={`import-map-sample-${field.key}`}
                        className="text-[11px] text-fg-muted leading-snug break-words line-clamp-3"
                        title={sample?.full ? sample.full : undefined}
                      >
                        <span className="font-medium text-fg-muted">Ejemplo:</span>{' '}
                        {sample?.preview
                          ? sample.preview
                          : 'Sin valor en las primeras filas del archivo.'}
                      </p>
                    )}
                  </div>
                  {mappingErrors[field.key] && (
                    <span className="text-[11px] text-danger shrink-0 pt-1 max-w-[5.5rem]">{mappingErrors[field.key]}</span>
                  )}
                </div>
              )})}
            </div>
            {defaultFillFields.length > 0 && (
              <div className="mt-4 rounded border border-border bg-surface-muted/90 px-3 py-3 space-y-3">
                <div>
                  <p className="text-[12px] font-medium text-fg">Valores por defecto</p>
                  <p className="text-[11px] text-fg-muted mt-0.5 leading-snug">
                    Si la celda del CSV está vacía para un campo que sí mapeaste, se usará el valor que elijas acá. No reemplaza datos que vengan en el archivo.
                  </p>
                </div>
                {defaultFillFields.map((f) => (
                  <div key={f.key} className="flex flex-col gap-1">
                    <label className="text-[12px] font-medium text-fg-muted" htmlFor={`import-default-${f.key}`}>
                      {f.label}
                    </label>
                    {f.description && (
                      <p className="text-[11px] text-fg-muted leading-snug">{f.description}</p>
                    )}
                    {f.inputKind === 'select' ? (
                      <select
                        id={`import-default-${f.key}`}
                        value={fillDefaults[f.key] ?? ''}
                        onChange={(e) =>
                          setFillDefaults((prev) => ({ ...prev, [f.key]: e.target.value }))
                        }
                        className="w-full h-7 text-[12px] border border-border-strong rounded-sm px-2 bg-surface focus:outline-none focus:border-ring"
                      >
                        {(f.options ?? [{ value: '', label: '—' }]).map((opt) => (
                          <option key={`${f.key}-${opt.value}`} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={`import-default-${f.key}`}
                        type="text"
                        value={fillDefaults[f.key] ?? ''}
                        onChange={(e) =>
                          setFillDefaults((prev) => ({ ...prev, [f.key]: e.target.value }))
                        }
                        placeholder={f.placeholder}
                        className="w-full h-7 text-[12px] border border-border-strong rounded-sm px-2 bg-surface focus:outline-none focus:border-ring"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'confirm' && (
          <div className="flex flex-col gap-4">
            <div className="rounded border border-border bg-surface-muted px-4 py-3 text-[13px] text-fg-muted space-y-1">
              <div><span className="font-medium">Archivo:</span> {file?.name}</div>
              <div><span className="font-medium">Filas:</span> {rowCount}</div>
              <div><span className="font-medium">Campos mapeados:</span> {mappedCount} de {fields.length}</div>
            </div>
            {showStockWarehousePicker && stockWarehouse && (
              <div className="rounded border border-border-strong bg-surface px-3 py-3 space-y-2">
                <label htmlFor="import-stock-warehouse-confirm" className="block text-[12px] font-medium text-fg">
                  {stockWarehouse.label ?? 'Depósito'}
                </label>
                {stockWarehouseRequired ? (
                  <>
                    <select
                      id="import-stock-warehouse-confirm"
                      value={stockWarehouseId}
                      onChange={(e) => {
                        setStockWarehouseId(e.target.value)
                        if (e.target.value.trim()) setStockWarehouseError(null)
                      }}
                      className={`w-full h-8 text-[13px] border rounded-sm px-2 bg-surface focus:outline-none focus:border-ring ${
                        stockWarehouseError ? 'border-danger' : 'border-border-strong'
                      }`}
                    >
                      <option value="">— Elegir depósito —</option>
                      {stockWarehouseOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    {stockWarehouseError && (
                      <p className="text-[11px] text-danger">{stockWarehouseError}</p>
                    )}
                    <p className="text-[11px] text-fg-muted leading-snug">
                      {stockWarehouse.description ??
                        'El stock del CSV se carga solo en productos que gestionen stock. No se sobrescribe stock ya existente en ese depósito.'}
                    </p>
                  </>
                ) : (
                  <p className="text-[12px] text-fg-muted leading-snug">
                    No hay depósitos en la organización. Creá uno en Inventario para cargar stock al importar.
                  </p>
                )}
              </div>
            )}
            <div>
              {hideActionSelect ? (
                <p className="text-[12px] text-fg-muted leading-relaxed">
                  {confirmHint ?? 'Se aplicarán las cantidades del CSV en este depósito (productos del catálogo que gestionen stock).'}
                </p>
              ) : (
                <>
                  <label className="block text-[12px] font-medium text-fg-muted mb-1">Acción ante registros existentes</label>
                  <select
                    value={action}
                    onChange={e => setAction(e.target.value as ImportAction)}
                    className="w-full h-8 text-[13px] border border-border-strong rounded-sm px-2 bg-surface focus:outline-none focus:border-ring"
                  >
                    {(Object.entries(ACTION_LABELS) as [ImportAction, string][]).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
            {serverError && (
              <div className="rounded border border-danger bg-danger-bg px-3 py-2 text-[13px] text-danger">
                {serverError}
              </div>
            )}
          </div>
        )}

        {step === 'importing' && (
          <div className="flex flex-col gap-4 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-medium text-fg">Importando…</span>
                {importProgress && (
                  <span className="text-fg-muted tabular-nums">
                    {importProgress.processed.toLocaleString('es-AR')} / {importProgress.total.toLocaleString('es-AR')} filas ({progressPct}%)
                  </span>
                )}
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-brand-600 transition-[width] duration-300 ease-out"
                  style={{ width: `${Math.max(progressPct, loading ? 3 : 0)}%` }}
                />
              </div>
              <p className="text-[12px] text-fg-muted">
                {supportsStreamProgress
                  ? 'Procesando filas en el servidor. No cierres esta ventana.'
                  : 'Procesando archivo. El avance es estimado hasta que termine la importación.'}
                {progressEta ? ` ${progressEta}.` : ''}
              </p>
            </div>
            <div className="rounded border border-border bg-surface-muted px-4 py-3 text-[13px] text-fg-muted space-y-1">
              <div><span className="font-medium">Archivo:</span> {file?.name}</div>
              <div><span className="font-medium">Acción:</span> {hideActionSelect ? 'Cargar cantidades' : ACTION_LABELS[action]}</div>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Creados',   value: result.created, color: 'text-success bg-success-bg border-success' },
                { label: 'Actualizados', value: result.updated, color: 'text-blue-700 bg-blue-50 border-blue-200' },
                { label: 'Omitidos',  value: result.skipped, color: 'text-fg-muted bg-surface-muted border-border' },
              ].map(({ label, value, color }) => (
                <div key={label} className={`rounded border px-2 py-3 ${color}`}>
                  <div className="text-xl font-semibold">{value}</div>
                  <div className="text-[11px] font-medium mt-0.5">{label}</div>
                </div>
              ))}
            </div>
            {result.errors.length > 0 && (
              <div>
                <p className="text-[12px] font-medium text-danger mb-1.5">
                  {result.errors.length} fila{result.errors.length !== 1 ? 's' : ''} con error
                  {(result.created + result.updated) > 0 ? ' — se importó el resto' : ' — no se importó ningún registro'}
                </p>
                <div className="max-h-48 overflow-y-auto border border-danger rounded text-[12px]">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-danger-bg">
                        <th className="px-3 py-1.5 text-left font-semibold text-danger w-16">Fila</th>
                        <th className="px-3 py-1.5 text-left font-semibold text-danger">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((err, idx) => (
                        <tr key={idx} className="border-t border-danger">
                          <td className="px-3 py-1.5 text-fg-muted">{err.row}</td>
                          <td className="px-3 py-1.5 text-fg">{err.message}</td>
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
      <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-surface-muted">
        <Button variant="secondary" size="sm" onClick={handleClose} disabled={loading || step === 'importing'}>
          {step === 'result' ? 'Cerrar' : 'Cancelar'}
        </Button>
        <div className="flex gap-2">
          {step === 'mapping' && (
            <Button variant="secondary" size="sm" onClick={() => setStep('upload')} disabled={loading}>Atrás</Button>
          )}
          {step === 'confirm' && (
            <Button variant="secondary" size="sm" onClick={() => setStep('mapping')} disabled={loading}>Atrás</Button>
          )}
          {step === 'mapping' && (
            <Button size="sm" onClick={() => { if (validateMapping()) setStep('confirm') }} disabled={loading}>
              Siguiente
            </Button>
          )}
          {step === 'confirm' && (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={loading || (stockWarehouseRequired && !stockWarehouseId.trim())}
            >
              Importar
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
