'use client'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { DatePicker } from './DatePicker'
import { FormField } from './FormField'

const meta: Meta<typeof DatePicker> = {
  title: 'Primitives/DatePicker',
  component: DatePicker,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof DatePicker>

export const Default: Story = {
  render: () => {
    const [date, setDate] = useState<Date | null>(null)
    return (
      <div className="w-48">
        <DatePicker value={date} onChange={setDate} />
        <p className="mt-2 text-xs text-fg-subtle">
          {date ? date.toISOString().slice(0, 10) : '(sin fecha)'}
        </p>
      </div>
    )
  },
}

export const WithInitialValue: Story = {
  render: () => {
    const [date, setDate] = useState<Date | null>(new Date('2026-12-31'))
    return (
      <div className="w-48">
        <DatePicker value={date} onChange={setDate} />
      </div>
    )
  },
}

export const Error: Story = {
  render: () => {
    const [date, setDate] = useState<Date | null>(null)
    return (
      <div className="w-48">
        <FormField label="Fecha de vencimiento" htmlFor="due" error="Fecha requerida" required>
          <DatePicker id="due" value={date} onChange={setDate} error />
        </FormField>
      </div>
    )
  },
}

export const Disabled: Story = {
  render: () => (
    <div className="w-48">
      <DatePicker value={new Date('2026-06-15')} onChange={() => {}} disabled />
    </div>
  ),
}

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-56">
      <FormField label="Normal" htmlFor="d1">
        <DatePicker id="d1" value={null} onChange={() => {}} />
      </FormField>
      <FormField label="Con valor" htmlFor="d2">
        <DatePicker id="d2" value={new Date('2026-04-21')} onChange={() => {}} />
      </FormField>
      <FormField label="Error" htmlFor="d3" error="Fecha inválida">
        <DatePicker id="d3" value={null} onChange={() => {}} error />
      </FormField>
      <FormField label="Deshabilitado" htmlFor="d4">
        <DatePicker id="d4" value={new Date('2026-01-01')} onChange={() => {}} disabled />
      </FormField>
    </div>
  ),
}
