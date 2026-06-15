'use client'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { CurrencyInput } from './CurrencyInput'
import { FormField } from './FormField'

const meta: Meta<typeof CurrencyInput> = {
  title: 'Primitives/CurrencyInput',
  component: CurrencyInput,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof CurrencyInput>

export const Default: Story = {
  render: () => {
    const [val, setVal] = useState('1234.56')
    return (
      <div className="w-48">
        <CurrencyInput value={val} onChange={setVal} placeholder="$ 0,00" />
        <p className="mt-2 text-xs text-fg-subtle">Valor interno: {val || '(vacío)'}</p>
      </div>
    )
  },
}

export const Empty: Story = {
  render: () => {
    const [val, setVal] = useState('')
    return (
      <div className="w-48">
        <CurrencyInput value={val} onChange={setVal} placeholder="$ 0,00" />
      </div>
    )
  },
}

export const LargeAmount: Story = {
  render: () => {
    const [val, setVal] = useState('9876543.21')
    return (
      <div className="w-56">
        <CurrencyInput value={val} onChange={setVal} />
        <p className="mt-2 text-xs text-fg-subtle">Valor: {val}</p>
      </div>
    )
  },
}

export const Error: Story = {
  render: () => {
    const [val, setVal] = useState('')
    return (
      <div className="w-48">
        <FormField label="Precio unitario" htmlFor="price" error="El precio no puede ser cero">
          <CurrencyInput id="price" value={val} onChange={setVal} error />
        </FormField>
      </div>
    )
  },
}

export const Disabled: Story = {
  args: { value: '5000.00', onChange: () => {}, disabled: true },
  render: (args) => (
    <div className="w-48">
      <CurrencyInput {...args} />
    </div>
  ),
}

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-64">
      <FormField label="Normal" htmlFor="n1">
        <CurrencyInput id="n1" value="1000" onChange={() => {}} />
      </FormField>
      <FormField label="Error" htmlFor="n2" error="Monto inválido">
        <CurrencyInput id="n2" value="" onChange={() => {}} error />
      </FormField>
      <FormField label="Deshabilitado" htmlFor="n3">
        <CurrencyInput id="n3" value="2500.50" onChange={() => {}} disabled />
      </FormField>
    </div>
  ),
}
