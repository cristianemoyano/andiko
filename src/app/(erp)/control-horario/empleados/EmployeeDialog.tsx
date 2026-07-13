'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogFooter } from '@/components/primitives/Dialog'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Switch } from '@/components/primitives/Switch'
import { Textarea } from '@/components/primitives/Textarea'
import { DatePicker } from '@/components/primitives/DatePicker'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifySuccess } from '@/lib/notify'
import { fieldErrorsFromApiError } from '@/lib/validation-errors'
import type { EmployeeRow, EmploymentType } from '../types'

export interface EmployeeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: EmployeeRow | null
  onSaved: () => void
}

const EMPLOYMENT_TYPE_OPTIONS: { value: EmploymentType; label: string }[] = [
  { value: 'mensualizado', label: 'Mensualizado' },
  { value: 'jornalizado', label: 'Jornalizado' },
  { value: 'por_hora', label: 'Por hora' },
]

type LinkableUser = { id: string; name: string; email: string }

export function EmployeeDialog({ open, onOpenChange, employee, onSaved }: EmployeeDialogProps) {
  const isEdit = !!employee
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [branchId, setBranchId] = useState('')
  const [userId, setUserId] = useState('')
  const [cuil, setCuil] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [position, setPosition] = useState('')
  const [employmentType, setEmploymentType] = useState<EmploymentType>('mensualizado')
  const [weeklyHours, setWeeklyHours] = useState('')
  const [hireDate, setHireDate] = useState<Date | null>(null)
  const [terminationDate, setTerminationDate] = useState<Date | null>(null)
  const [externalCode, setExternalCode] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [notes, setNotes] = useState('')

  const [branches, setBranches] = useState<Array<{ id: string; name: string; branch_code: number }>>([])
  const [users, setUsers] = useState<LinkableUser[]>([])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setFirstName(employee?.first_name ?? '')
      setLastName(employee?.last_name ?? '')
      setBranchId(employee?.branch_id ?? '')
      setUserId(employee?.user_id ?? '')
      setCuil(employee?.cuil ?? '')
      setEmail(employee?.email ?? '')
      setPhone(employee?.phone ?? '')
      setPosition(employee?.position ?? '')
      setEmploymentType(employee?.employment_type ?? 'mensualizado')
      setWeeklyHours(
        employee?.standard_weekly_minutes ? String(employee.standard_weekly_minutes / 60) : '',
      )
      setHireDate(employee?.hire_date ? new Date(employee.hire_date) : null)
      setTerminationDate(employee?.termination_date ? new Date(employee.termination_date) : null)
      setExternalCode(employee?.external_employee_code ?? '')
      setIsActive(employee?.is_active ?? true)
      setNotes(employee?.notes ?? '')
      setErrors({})
      setServerError(null)
    })
  }, [open, employee])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      try {
        const [branchesRes, usersRes] = await Promise.all([
          fetchJson<{ data: Array<{ id: string; name: string; branch_code: number }> }>('/api/v1/branches?limit=100'),
          fetchJson<{ data: LinkableUser[] }>('/api/v1/attendance/employees/linkable-users'),
        ])
        if (cancelled) return
        setBranches(branchesRes.data ?? [])
        setUsers(usersRes.data ?? [])
      } catch {
        if (!cancelled) { setBranches([]); setUsers([]) }
      }
    })()
    return () => { cancelled = true }
  }, [open])

  async function handleSave() {
    setSaving(true)
    setErrors({})
    setServerError(null)

    const weeklyMinutes = weeklyHours.trim() ? Math.round(parseFloat(weeklyHours) * 60) : null
    const body = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      branch_id: branchId,
      user_id: userId || null,
      cuil: cuil.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      position: position.trim() || null,
      employment_type: employmentType,
      standard_weekly_minutes: weeklyMinutes,
      hire_date: hireDate,
      termination_date: terminationDate,
      external_employee_code: externalCode.trim() || null,
      is_active: isActive,
      notes: notes.trim() || null,
    }

    try {
      if (isEdit) {
        await fetchJson(`/api/v1/attendance/employees/${employee.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      } else {
        await fetchJson('/api/v1/attendance/employees', {
          method: 'POST',
          body: JSON.stringify(body),
        })
      }
      notifySuccess(isEdit ? 'Empleado actualizado' : 'Empleado creado')
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

  const canSave = firstName.trim() && lastName.trim() && branchId && hireDate

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Editar empleado' : 'Nuevo empleado'}
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
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Nombre" htmlFor="emp_first_name" required error={errors.first_name?.[0]}>
            <Input id="emp_first_name" value={firstName} onChange={e => setFirstName(e.target.value)} />
          </FormField>
          <FormField label="Apellido" htmlFor="emp_last_name" required error={errors.last_name?.[0]}>
            <Input id="emp_last_name" value={lastName} onChange={e => setLastName(e.target.value)} />
          </FormField>
        </div>

        <FormField label="Sucursal" htmlFor="emp_branch" required error={errors.branch_id?.[0]}>
          <Select
            id="emp_branch"
            value={branchId}
            onChange={setBranchId}
            options={branches.map(b => ({ value: b.id, label: `${String(b.branch_code).padStart(2, '0')} — ${b.name}` }))}
            placeholder="Seleccionar sucursal…"
          />
        </FormField>

        <FormField label="Usuario del sistema vinculado" htmlFor="emp_user" error={errors.user_id?.[0]}>
          <Select
            id="emp_user"
            value={userId}
            onChange={setUserId}
            options={[
              { value: '', label: 'Sin acceso al sistema' },
              ...users.map(u => ({ value: u.id, label: `${u.name} (${u.email})` })),
            ]}
            placeholder="Sin acceso al sistema"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="CUIL" htmlFor="emp_cuil" error={errors.cuil?.[0]}>
            <Input id="emp_cuil" value={cuil} onChange={e => setCuil(e.target.value)} placeholder="20-12345678-9" />
          </FormField>
          <FormField label="Puesto" htmlFor="emp_position" error={errors.position?.[0]}>
            <Input id="emp_position" value={position} onChange={e => setPosition(e.target.value)} />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Email" htmlFor="emp_email" error={errors.email?.[0]}>
            <Input id="emp_email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </FormField>
          <FormField label="Teléfono" htmlFor="emp_phone" error={errors.phone?.[0]}>
            <Input id="emp_phone" value={phone} onChange={e => setPhone(e.target.value)} />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Tipo de jornada" htmlFor="emp_employment_type">
            <Select
              id="emp_employment_type"
              value={employmentType}
              onChange={v => setEmploymentType(v as EmploymentType)}
              options={EMPLOYMENT_TYPE_OPTIONS}
            />
          </FormField>
          <FormField label="Horas semanales pactadas" htmlFor="emp_weekly_hours" error={errors.standard_weekly_minutes?.[0]}>
            <Input
              id="emp_weekly_hours"
              type="number"
              min="0"
              step="0.5"
              value={weeklyHours}
              onChange={e => setWeeklyHours(e.target.value)}
              placeholder="Ej: 40"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Fecha de ingreso" htmlFor="emp_hire_date" required error={errors.hire_date?.[0]}>
            <DatePicker id="emp_hire_date" value={hireDate} onChange={setHireDate} />
          </FormField>
          <FormField label="Fecha de egreso" htmlFor="emp_termination_date" error={errors.termination_date?.[0]}>
            <DatePicker id="emp_termination_date" value={terminationDate} onChange={setTerminationDate} />
          </FormField>
        </div>

        <FormField label="Código de legajo (reloj físico)" htmlFor="emp_external_code" error={errors.external_employee_code?.[0]}>
          <Input
            id="emp_external_code"
            value={externalCode}
            onChange={e => setExternalCode(e.target.value)}
            placeholder="Código configurado en el reloj biométrico"
          />
        </FormField>

        <FormField label="Notas" htmlFor="emp_notes">
          <Textarea id="emp_notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
        </FormField>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-fg-muted">Activo</span>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </div>
    </Dialog>
  )
}
