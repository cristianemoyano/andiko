'use client'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { SearchableSelect } from './SearchableSelect'
import { FormField } from '@/components/primitives/FormField'

const CONTACTS = [
  { value: '1', label: 'Acero del Sur S.A.', sublabel: '30-12345678-9 · Responsable Inscripto' },
  { value: '2', label: 'Distribuidora Norte SRL', sublabel: '30-98765432-1 · Responsable Inscripto' },
  { value: '3', label: 'Juan Martínez', sublabel: '20-33445566-7 · Monotributista' },
  { value: '4', label: 'Importadora Global S.A.', sublabel: '30-11223344-5 · Responsable Inscripto' },
  { value: '5', label: 'Ferretería El Tornillo', sublabel: '27-55667788-3 · Consumidor Final' },
]

const meta: Meta<typeof SearchableSelect> = {
  title: 'ERP/SearchableSelect',
  component: SearchableSelect,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof SearchableSelect>

export const ContactSelector: Story = {
  render: () => {
    const [value, setValue] = useState<string | null>(null)
    return (
      <div className="w-80">
        <FormField label="Cliente" htmlFor="contact">
          <SearchableSelect
            id="contact"
            value={value}
            onChange={setValue}
            options={CONTACTS}
            placeholder="Buscar cliente…"
          />
        </FormField>
        <p className="mt-2 text-xs text-fg-subtle">Seleccionado: {value ?? '(ninguno)'}</p>
      </div>
    )
  },
}

export const WithInitialValue: Story = {
  render: () => {
    const [value, setValue] = useState<string | null>('2')
    return (
      <div className="w-80">
        <SearchableSelect
          value={value}
          onChange={setValue}
          options={CONTACTS}
          placeholder="Buscar cliente…"
        />
      </div>
    )
  },
}

export const AsyncSearch: Story = {
  render: () => {
    const [value, setValue] = useState<string | null>(null)
    async function fakeSearch(q: string) {
      await new Promise(r => setTimeout(r, 600))
      return CONTACTS.filter(c =>
        c.label.toLowerCase().includes(q.toLowerCase()) ||
        c.sublabel?.toLowerCase().includes(q.toLowerCase()),
      )
    }
    return (
      <div className="w-80">
        <FormField label="Producto" htmlFor="product">
          <SearchableSelect
            id="product"
            value={value}
            onChange={setValue}
            onSearch={fakeSearch}
            placeholder="Buscar producto…"
          />
        </FormField>
      </div>
    )
  },
}

export const Error: Story = {
  render: () => {
    const [value, setValue] = useState<string | null>(null)
    return (
      <div className="w-80">
        <FormField label="Cliente" htmlFor="c2" error="Seleccioná un cliente" required>
          <SearchableSelect
            id="c2"
            value={value}
            onChange={setValue}
            options={CONTACTS}
            placeholder="Buscar cliente…"
            error
          />
        </FormField>
      </div>
    )
  },
}

export const Disabled: Story = {
  render: () => (
    <div className="w-80">
      <SearchableSelect
        value="1"
        onChange={() => {}}
        options={CONTACTS}
        disabled
      />
    </div>
  ),
}

export const EmptyOptions: Story = {
  render: () => {
    const [value, setValue] = useState<string | null>(null)
    return (
      <div className="w-80">
        <SearchableSelect
          value={value}
          onChange={setValue}
          options={[]}
          placeholder="Sin opciones disponibles"
        />
      </div>
    )
  },
}
