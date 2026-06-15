'use client'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { Checkbox, type CheckboxCheckedState } from './Checkbox'

const meta: Meta<typeof Checkbox> = {
  title: 'Primitives/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof Checkbox>

export const Default: Story = {
  args: { label: 'Incluir IVA en el precio' },
}

export const Checked: Story = {
  args: { label: 'Cliente habitual', defaultChecked: true },
}

export const WithoutLabel: Story = {
  render: () => <Checkbox aria-label="Seleccionar fila" />,
}

export const Indeterminate: Story = {
  render: () => {
    const [checked, setChecked] = useState<CheckboxCheckedState>('indeterminate')
    return (
      <div className="flex flex-col gap-2">
        <Checkbox
          label="Seleccionar todos los ítems"
          checked={checked}
          onCheckedChange={setChecked}
        />
        <p className="text-[11px] text-fg-muted">Estado: {String(checked)}</p>
      </div>
    )
  },
}

export const Disabled: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Checkbox label="Deshabilitado sin marcar" disabled />
      <Checkbox label="Deshabilitado marcado" disabled defaultChecked />
      <Checkbox label="Deshabilitado indeterminado" disabled checked="indeterminate" />
    </div>
  ),
}

export const ErrorState: Story = {
  args: { label: 'Acepto los términos y condiciones', error: true },
}

export const LongLabel: Story = {
  args: {
    label:
      'Autorizo a Andiko a emitir comprobantes electrónicos ante AFIP en mi nombre y declaro que los datos fiscales ingresados (CUIT, condición frente al IVA y domicilio fiscal) son correctos y se encuentran actualizados.',
    className: 'max-w-sm',
  },
}

export const Group: Story = {
  render: () => (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-1 text-[12px] font-medium text-fg-muted">Módulos habilitados</legend>
      <Checkbox label="Ventas" defaultChecked />
      <Checkbox label="Compras" defaultChecked />
      <Checkbox label="Inventario" />
      <Checkbox label="Contabilidad" disabled />
    </fieldset>
  ),
}
