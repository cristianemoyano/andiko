'use client'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { Select } from './Select'
import { FormField } from './FormField'

const IVA_OPTIONS = [
  { value: 'responsable_inscripto', label: 'Responsable Inscripto' },
  { value: 'monotributista', label: 'Monotributista' },
  { value: 'exento', label: 'Exento' },
  { value: 'consumidor_final', label: 'Consumidor Final' },
]

const meta: Meta<typeof Select> = {
  title: 'Primitives/Select',
  component: Select,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof Select>

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState<string | null>(null)
    return (
      <div className="max-w-xs">
        <Select
          value={value}
          onChange={setValue}
          options={IVA_OPTIONS}
          placeholder="Condición frente al IVA"
        />
      </div>
    )
  },
}

export const WithValue: Story = {
  render: () => {
    const [value, setValue] = useState<string | null>('monotributista')
    return (
      <div className="max-w-xs">
        <Select value={value} onChange={setValue} options={IVA_OPTIONS} />
      </div>
    )
  },
}

export const ErrorState: Story = {
  render: () => {
    const [value, setValue] = useState<string | null>(null)
    return (
      <div className="max-w-xs">
        <FormField label="Condición frente al IVA" htmlFor="iva" required error="Campo obligatorio">
          <Select
            id="iva"
            value={value}
            onChange={setValue}
            options={IVA_OPTIONS}
            error
            placeholder="Seleccionar…"
          />
        </FormField>
      </div>
    )
  },
}

export const Disabled: Story = {
  render: () => (
    <div className="flex max-w-xs flex-col gap-3">
      <Select value={null} onChange={() => {}} options={IVA_OPTIONS} disabled placeholder="Deshabilitado vacío" />
      <Select value="exento" onChange={() => {}} options={IVA_OPTIONS} disabled />
    </div>
  ),
}

export const DisabledOption: Story = {
  render: () => {
    const [value, setValue] = useState<string | null>(null)
    return (
      <div className="max-w-xs">
        <Select
          value={value}
          onChange={setValue}
          options={[
            { value: 'efectivo', label: 'Efectivo' },
            { value: 'transferencia', label: 'Transferencia' },
            { value: 'cheque', label: 'Cheque (no disponible)', disabled: true },
            { value: 'tarjeta', label: 'Tarjeta' },
          ]}
          placeholder="Medio de pago"
        />
      </div>
    )
  },
}

export const EmptyOptions: Story = {
  render: () => {
    const [value, setValue] = useState<string | null>(null)
    return (
      <div className="max-w-xs">
        <Select value={value} onChange={setValue} options={[]} placeholder="Sin opciones disponibles" />
      </div>
    )
  },
}

export const LongLabels: Story = {
  render: () => {
    const [value, setValue] = useState<string | null>(null)
    return (
      <div className="max-w-[220px]">
        <Select
          value={value}
          onChange={setValue}
          options={[
            { value: 'a', label: 'Factura A — Responsable Inscripto a Responsable Inscripto' },
            { value: 'b', label: 'Factura B — Responsable Inscripto a Consumidor Final / Exento' },
            { value: 'c', label: 'Factura C — Monotributista a cualquier receptor' },
          ]}
          placeholder="Tipo de comprobante"
        />
      </div>
    )
  },
}
