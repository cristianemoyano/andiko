'use client'

import { useState } from 'react'
import { Dialog, DialogFooter } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Select } from '@/components/primitives/Select'
import { Input } from '@/components/primitives/Input'
import { parseCsvText } from '@/lib/csv'
import { notifySuccess } from '@/lib/notify'

export interface AttendanceImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  branches: Array<{ id: string; name: string; branch_code: number }>
  onImported: () => void
}

type ImportResult = { created: number; skipped: number; errors: { row: number; message: string }[] }

const IGNORE = '__ignore__'
const FIELDS = [
  { key: 'employee_code', label: 'Código de empleado' },
  { key: 'occurred_at', label: 'Fecha y hora' },
  { key: 'event_type', label: 'Tipo de evento' },
]

export function AttendanceImportDialog({ open, onOpenChange, branches, onImported }: AttendanceImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [branchId, setBranchId] = useState('')
  const [aliasClockIn, setAliasClockIn] = useState('IN')
  const [aliasClockOut, setAliasClockOut] = useState('OUT')
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  function reset() {
    setFile(null)
    setCsvHeaders([])
    setMapping({})
    setBranchId('')
    setAliasClockIn('IN')
    setAliasClockOut('OUT')
    setServerError(null)
    setResult(null)
    setLoading(false)
  }

  function handleClose() {
    reset()
    onOpenChange(false)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const { headers } = parseCsvText(text)
      setCsvHeaders(headers)
      const autoMap: Record<string, string> = {}
      for (const field of FIELDS) {
        const match = headers.find(h => h.toLowerCase() === field.label.toLowerCase() || h.toLowerCase() === field.key.toLowerCase())
        autoMap[field.key] = match ?? IGNORE
      }
      setMapping(autoMap)
    }
    reader.readAsText(f)
  }

  const canSubmit = file && branchId && aliasClockIn.trim() && aliasClockOut.trim() &&
    FIELDS.every(f => mapping[f.key] && mapping[f.key] !== IGNORE)

  async function handleSubmit() {
    if (!file || !canSubmit) return
    setLoading(true)
    setServerError(null)

    const effectiveMapping: Record<string, string> = {}
    for (const [key, col] of Object.entries(mapping)) {
      if (col && col !== IGNORE) effectiveMapping[key] = col
    }

    const fd = new FormData()
    fd.append('file', file)
    fd.append('branch_id', branchId)
    fd.append('alias_clock_in', aliasClockIn.trim())
    fd.append('alias_clock_out', aliasClockOut.trim())
    fd.append('mapping', JSON.stringify(effectiveMapping))

    try {
      const res = await fetch('/api/v1/attendance/events/import', { method: 'POST', body: fd, credentials: 'same-origin' })
      const data = await res.json() as ImportResult & { error?: string }
      if (!res.ok && !data.errors) {
        setServerError(data.error ?? 'Error al importar')
        return
      }
      setResult(data)
      if (!data.errors || data.errors.length === 0) {
        notifySuccess(`Importación completa: ${data.created} fichadas creadas, ${data.skipped} omitidas`)
        onImported()
      }
    } catch {
      setServerError('Error de red al importar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleClose}
      title="Importar fichadas desde reloj"
      footer={
        <DialogFooter error={serverError}>
          <Button variant="secondary" size="sm" onClick={handleClose} disabled={loading}>
            {result ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!result && (
            <Button size="sm" onClick={handleSubmit} disabled={loading || !canSubmit}>
              {loading ? 'Importando…' : 'Importar'}
            </Button>
          )}
        </DialogFooter>
      }
    >
      {!result ? (
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-fg-muted">
            Subí el archivo CSV exportado por el reloj biométrico. Las fichadas se cargan como origen «Reloj físico»
            y las que ya estén importadas no se duplican.
          </p>

          <FormField label="Archivo CSV" htmlFor="import_file" required>
            <input
              id="import_file"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="text-[13px] text-fg-muted file:mr-3 file:py-1 file:px-3 file:rounded file:border file:border-border-strong file:text-[12px] file:bg-surface file:cursor-pointer hover:file:bg-surface-muted"
            />
          </FormField>

          <FormField label="Sucursal" htmlFor="import_branch" required>
            <Select
              id="import_branch"
              value={branchId}
              onChange={setBranchId}
              options={branches.map(b => ({ value: b.id, label: `${String(b.branch_code).padStart(2, '0')} — ${b.name}` }))}
              placeholder="Todas las fichadas del archivo se asignan a esta sucursal…"
            />
          </FormField>

          {csvHeaders.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[12px] font-medium text-fg-muted">Mapeo de columnas</p>
              {FIELDS.map(field => (
                <div key={field.key} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 text-[12px] text-fg-muted">{field.label}</span>
                  <select
                    value={mapping[field.key] ?? IGNORE}
                    onChange={e => setMapping(m => ({ ...m, [field.key]: e.target.value }))}
                    className="h-7 flex-1 rounded-sm border border-border-strong bg-surface px-2 text-[12px] focus:outline-none focus:border-ring"
                  >
                    <option value={IGNORE}>— Elegir columna —</option>
                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Valor de «entrada» en el archivo" htmlFor="import_alias_in" required>
              <Input id="import_alias_in" value={aliasClockIn} onChange={e => setAliasClockIn(e.target.value)} />
            </FormField>
            <FormField label="Valor de «salida» en el archivo" htmlFor="import_alias_out" required>
              <Input id="import_alias_out" value={aliasClockOut} onChange={e => setAliasClockOut(e.target.value)} />
            </FormField>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded border border-success bg-success-bg px-2 py-3 text-success">
              <div className="text-xl font-semibold">{result.created}</div>
              <div className="mt-0.5 text-[11px] font-medium">Creadas</div>
            </div>
            <div className="rounded border border-border bg-surface-muted px-2 py-3 text-fg-muted">
              <div className="text-xl font-semibold">{result.skipped}</div>
              <div className="mt-0.5 text-[11px] font-medium">Omitidas (ya importadas)</div>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div>
              <p className="mb-1.5 text-[12px] font-medium text-danger">
                {result.errors.length} fila{result.errors.length !== 1 ? 's' : ''} con error
              </p>
              <div className="max-h-48 overflow-y-auto rounded border border-danger text-[12px]">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-danger-bg">
                      <th className="w-16 px-3 py-1.5 text-left font-semibold text-danger">Fila</th>
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
    </Dialog>
  )
}
