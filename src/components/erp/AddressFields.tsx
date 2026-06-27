'use client'

import { Input } from '@/components/primitives/Input'
import { FormField } from '@/components/primitives/FormField'

/** Structured postal address captured by the form. All fields are strings
 *  (empty = not set) so they bind directly to controlled inputs. */
export interface AddressValue {
  street: string
  number: string
  floor: string
  apartment: string
  city: string
  province: string
  postal_code: string
  country: string
}

export const EMPTY_ADDRESS: AddressValue = {
  street: '', number: '', floor: '', apartment: '',
  city: '', province: '', postal_code: '', country: 'Argentina',
}

export type AddressErrors = Partial<Record<keyof AddressValue, string>>

export interface AddressFieldsProps {
  value: AddressValue
  onChange: (next: AddressValue) => void
  errors?: AddressErrors
  /** Prefix for input ids so multiple address blocks can coexist on one page. */
  idPrefix?: string
  disabled?: boolean
  /** Mark street/city/province as required in the UI (validation is the caller's job). */
  requireCore?: boolean
}

/**
 * Reusable structured address editor matching the canonical address shape used
 * across the app (contacts, sales orders): street, number, floor, apartment,
 * city, province, postal code and country. Presentational and fully
 * controlled — validation and persistence are the caller's responsibility.
 */
export function AddressFields({
  value,
  onChange,
  errors = {},
  idPrefix = 'address',
  disabled = false,
  requireCore = false,
}: AddressFieldsProps) {
  const set = (key: keyof AddressValue, v: string) => onChange({ ...value, [key]: v })
  const id = (key: string) => `${idPrefix}_${key}`

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
        <FormField label="Calle" htmlFor={id('street')} error={errors.street} required={requireCore}>
          <Input id={id('street')} value={value.street} error={!!errors.street} disabled={disabled}
            placeholder="Av. Siempreviva" onChange={e => set('street', e.target.value)} />
        </FormField>
        <FormField label="Número" htmlFor={id('number')} error={errors.number}>
          <Input id={id('number')} value={value.number} error={!!errors.number} disabled={disabled}
            placeholder="742" onChange={e => set('number', e.target.value)} />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Piso" htmlFor={id('floor')} error={errors.floor}>
          <Input id={id('floor')} value={value.floor} error={!!errors.floor} disabled={disabled}
            placeholder="3" onChange={e => set('floor', e.target.value)} />
        </FormField>
        <FormField label="Departamento" htmlFor={id('apartment')} error={errors.apartment}>
          <Input id={id('apartment')} value={value.apartment} error={!!errors.apartment} disabled={disabled}
            placeholder="B" onChange={e => set('apartment', e.target.value)} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
        <FormField label="Ciudad / Localidad" htmlFor={id('city')} error={errors.city} required={requireCore}>
          <Input id={id('city')} value={value.city} error={!!errors.city} disabled={disabled}
            placeholder="Mendoza" onChange={e => set('city', e.target.value)} />
        </FormField>
        <FormField label="Código postal" htmlFor={id('postal_code')} error={errors.postal_code}>
          <Input id={id('postal_code')} value={value.postal_code} error={!!errors.postal_code} disabled={disabled}
            placeholder="5500" onChange={e => set('postal_code', e.target.value)} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Provincia" htmlFor={id('province')} error={errors.province} required={requireCore}>
          <Input id={id('province')} value={value.province} error={!!errors.province} disabled={disabled}
            placeholder="Mendoza" onChange={e => set('province', e.target.value)} />
        </FormField>
        <FormField label="País" htmlFor={id('country')} error={errors.country}>
          <Input id={id('country')} value={value.country} error={!!errors.country} disabled={disabled}
            placeholder="Argentina" onChange={e => set('country', e.target.value)} />
        </FormField>
      </div>
    </div>
  )
}
