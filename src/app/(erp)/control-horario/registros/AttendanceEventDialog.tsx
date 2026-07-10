'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogFooter } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Select } from '@/components/primitives/Select'
import { Textarea } from '@/components/primitives/Textarea'
import { DatePicker } from '@/components/primitives/DatePicker'
import { TimeInput } from '@/components/primitives/TimeInput'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifySuccess } from '@/lib/notify'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'
import { resolveWorkDate } from '@/modules/attendance/attendance.utils'
import type { EmployeeRow } from '../types'

export interface AttendanceEventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employees: EmployeeRow[]
  branches: Array<{ id: string; name: string; branch_code: number }>
  onSaved: () => void
}

type Mode = 'session' | 'single' | 'absence'

const MODE_LABEL: Record<Mode, string> = {
  session: 'Sesión (entrada + salida)',
  single: 'Evento único',
  absence: 'Ausencia',
}

/** Argentina no tiene horario de verano — el offset -03:00 es siempre correcto. */
function toArgentinaIso(date: Date, time: string): string {
  return `${resolveWorkDate(date)}T${time}:00-03:00`
}

export function AttendanceEventDialog({ open, onOpenChange, employees, branches, onSaved }: AttendanceEventDialogProps) {
  const [mode, setMode] = useState<Mode>('session')
  const [employeeId, setEmployeeId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [workDate, setWorkDate] = useState<Date | null>(null)
  const [clockInTime, setClockInTime] = useState('09:00')
  const [clockOutTime, setClockOutTime] = useState('18:00')
  const [eventType, setEventType] = useState<'clock_in' | 'clock_out'>('clock_in')
  const [eventTime, setEventTime] = useState('09:00')
  const [note, setNote] = useState('')

  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setMode('session')
      setEmployeeId('')
      setBranchId('')
      setWorkDate(new Date())
      setClockInTime('09:00')
      setClockOutTime('18:00')
      setEventType('clock_in')
      setEventTime('09:00')
      setNote('')
      setErrors({})
      setServerError(null)
    })
  }, [open])

  async function handleSave() {
    if (!employeeId || !branchId || !workDate) return
    setSaving(true)
    setErrors({})
    setServerError(null)

    try {
      if (mode === 'session') {
        await fetchJson('/api/v1/attendance/sessions', {
          method: 'POST',
          body: JSON.stringify({
            employee_id: employeeId,
            branch_id: branchId,
            work_date: workDate,
            clock_in_time: clockInTime,
            clock_out_time: clockOutTime,
            note: note.trim() || null,
          }),
        })
      } else if (mode === 'single') {
        await fetchJson('/api/v1/attendance/events', {
          method: 'POST',
          body: JSON.stringify({
            employee_id: employeeId,
            branch_id: branchId,
            event_type: eventType,
            occurred_at: toArgentinaIso(workDate, eventTime),
            note: note.trim() || null,
          }),
        })
      } else {
        await fetchJson('/api/v1/attendance/absences', {
          method: 'POST',
          body: JSON.stringify({
            employee_id: employeeId,
            branch_id: branchId,
            work_date: workDate,
            note: note.trim() || null,
          }),
        })
      }
      notifySuccess('Registro creado')
      onOpenChange(false)
      onSaved()
    } catch (e) {
      const fe = fieldErrorsFromApiError(e)
      if (fe) setErrors(fe)
      else setServerError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const canSave = employeeId && branchId && workDate

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nuevo registro"
      footer={
        <DialogFooter error={serverError}>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !canSave}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-1 rounded-sm border border-border bg-surface-muted p-1">
          {(Object.keys(MODE_LABEL) as Mode[]).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-sm px-2 py-1.5 text-[12px] font-medium transition-colors ${
                mode === m ? 'bg-surface text-fg shadow-sm border border-border' : 'text-fg-muted hover:text-fg'
              }`}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>

        <FormField label="Empleado" htmlFor="ev_employee" required error={errors.employee_id?.[0]}>
          <Select
            id="ev_employee"
            value={employeeId}
            onChange={setEmployeeId}
            options={employees.map(e => ({ value: e.id, label: `${e.first_name} ${e.last_name}` }))}
            placeholder="Seleccionar empleado…"
          />
        </FormField>

        <FormField label="Sucursal" htmlFor="ev_branch" required error={errors.branch_id?.[0]}>
          <Select
            id="ev_branch"
            value={branchId}
            onChange={setBranchId}
            options={branches.map(b => ({ value: b.id, label: `${String(b.branch_code).padStart(2, '0')} — ${b.name}` }))}
            placeholder="Seleccionar sucursal…"
          />
        </FormField>

        <FormField label="Fecha" htmlFor="ev_date" required error={errors.work_date?.[0]}>
          <DatePicker id="ev_date" value={workDate} onChange={setWorkDate} />
        </FormField>

        {mode === 'session' && (
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Entrada" htmlFor="ev_clock_in" error={errors.clock_in_time?.[0]}>
              <TimeInput id="ev_clock_in" value={clockInTime} onChange={setClockInTime} />
            </FormField>
            <FormField label="Salida" htmlFor="ev_clock_out" error={errors.clock_out_time?.[0]}>
              <TimeInput id="ev_clock_out" value={clockOutTime} onChange={setClockOutTime} />
            </FormField>
          </div>
        )}

        {mode === 'single' && (
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tipo" htmlFor="ev_type">
              <Select
                id="ev_type"
                value={eventType}
                onChange={v => setEventType(v as 'clock_in' | 'clock_out')}
                options={[
                  { value: 'clock_in', label: 'Entrada' },
                  { value: 'clock_out', label: 'Salida' },
                ]}
              />
            </FormField>
            <FormField label="Hora" htmlFor="ev_time" error={errors.occurred_at?.[0]}>
              <TimeInput id="ev_time" value={eventTime} onChange={setEventTime} />
            </FormField>
          </div>
        )}

        <FormField label="Nota" htmlFor="ev_note">
          <Textarea id="ev_note" value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Motivo de la corrección o ausencia (opcional)" />
        </FormField>
      </div>
    </Dialog>
  )
}
