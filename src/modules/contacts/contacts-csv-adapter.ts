import type { CsvHeader } from '@/lib/csv'
import type { ContactAttributes } from './contact.model'
import type { ContactInput, ContactUpdateInput } from './contact.schema'

export const CONTACT_CSV_HEADERS: CsvHeader[] = [
  { key: 'type',          label: 'Tipo' },
  { key: 'legal_name',    label: 'Razón social' },
  { key: 'trade_name',    label: 'Nombre comercial' },
  { key: 'first_name',    label: 'Nombre' },
  { key: 'last_name',     label: 'Apellido' },
  { key: 'job_title',     label: 'Puesto' },
  { key: 'cuit',          label: 'CUIT' },
  { key: 'iva_condition', label: 'Condición IVA' },
  { key: 'email',         label: 'Email' },
  { key: 'phone',         label: 'Teléfono' },
  { key: 'is_active',     label: 'Activo' },
]

export const CONTACT_CSV_MATCH_KEY = 'cuit'

type ContactRow = Pick<ContactAttributes,
  'type' | 'legal_name' | 'trade_name' | 'first_name' | 'last_name' |
  'job_title' | 'cuit' | 'iva_condition' | 'email' | 'phone' | 'is_active'
>

export function contactToRow(c: ContactRow): Record<string, string> {
  return {
    type:          c.type,
    legal_name:    c.legal_name,
    trade_name:    c.trade_name ?? '',
    first_name:    c.first_name ?? '',
    last_name:     c.last_name ?? '',
    job_title:     c.job_title ?? '',
    cuit:          c.cuit ?? '',
    iva_condition: c.iva_condition,
    email:         c.email ?? '',
    phone:         c.phone ?? '',
    is_active:     c.is_active ? 'true' : 'false',
  }
}

export function rowToContactInput(row: Record<string, string>): ContactInput {
  return {
    type:          row.type as ContactInput['type'],
    legal_name:    row.legal_name,
    trade_name:    row.trade_name || null,
    first_name:    row.first_name || null,
    last_name:     row.last_name || null,
    job_title:     row.job_title || null,
    cuit:          row.cuit || null,
    iva_condition: row.iva_condition as ContactInput['iva_condition'],
    email:         row.email || null,
    phone:         row.phone || null,
  }
}

export function rowToContactUpdateInput(row: Record<string, string>): ContactUpdateInput {
  const base = rowToContactInput(row)
  return {
    ...base,
    is_active: row.is_active === '' ? undefined : row.is_active === 'true',
  }
}
