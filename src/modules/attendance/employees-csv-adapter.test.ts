import { describe, it, expect } from 'vitest'
import {
  normalizeEmployeeImportRow,
  rowToEmployeeInput,
  rowToEmployeeUpdateInput,
} from './employees-csv-adapter'

describe('employees-csv-adapter', () => {
  it('normalizes a complete row and converts weekly hours to minutes', () => {
    const mapped = normalizeEmployeeImportRow({
      first_name: ' Ana ',
      last_name: ' Gómez ',
      branch_code: '1',
      hire_date: '2026-01-15',
      external_employee_code: '1001',
      cuil: '20-12345678-9',
      email: 'ana@example.com',
      phone: '',
      position: 'Cajera',
      employment_type: 'jornalizado',
      weekly_hours: '40',
      termination_date: '',
      is_active: 'si',
      notes: '',
    })

    expect(mapped.first_name).toBe('Ana')
    expect(mapped.last_name).toBe('Gómez')
    expect(mapped.standard_weekly_minutes).toBe(2400)
    expect(mapped.is_active).toBe(true)
    expect(mapped.employment_type).toBe('jornalizado')
    expect(mapped.phone).toBeNull()
    expect(mapped.termination_date).toBeNull()

    const input = rowToEmployeeInput(mapped, 'branch-uuid')
    expect(input.branch_id).toBe('branch-uuid')
    expect(input.external_employee_code).toBe('1001')
    expect(input.hire_date).toEqual(new Date('2026-01-15'))
  })

  it('flags invalid weekly hours and employment type as undefined sentinels', () => {
    const mapped = normalizeEmployeeImportRow({
      first_name: 'Ana',
      last_name: 'Gómez',
      branch_code: '1',
      hire_date: '2026-01-15',
      weekly_hours: 'abc',
      employment_type: 'freelance',
      is_active: 'maybe',
      termination_date: 'not-a-date',
    })
    expect(mapped.standard_weekly_minutes).toBeUndefined()
    expect(mapped.employment_type).toBeUndefined()
    expect(mapped.is_active).toBeUndefined()
    expect(mapped.termination_date).toBeUndefined()
  })

  it('builds a partial update payload without forcing defaults', () => {
    const mapped = normalizeEmployeeImportRow({
      first_name: 'Ana',
      last_name: 'Gómez',
      branch_code: '',
      hire_date: '',
      external_employee_code: '1001',
      is_active: 'false',
    })
    const update = rowToEmployeeUpdateInput(mapped, undefined)
    expect(update.branch_id).toBeUndefined()
    expect(update.hire_date).toBeUndefined()
    expect(update.is_active).toBe(false)
    expect(update.external_employee_code).toBe('1001')
  })
})
