import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { AddressFields, EMPTY_ADDRESS, type AddressValue } from './AddressFields'

const meta: Meta<typeof AddressFields> = {
  title: 'ERP/AddressFields',
  component: AddressFields,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof AddressFields>

function Controlled({ initial, ...rest }: { initial: AddressValue } & Partial<Parameters<typeof AddressFields>[0]>) {
  const [value, setValue] = useState<AddressValue>(initial)
  return (
    <div className="max-w-xl">
      <AddressFields value={value} onChange={setValue} {...rest} />
    </div>
  )
}

export const Empty: Story = {
  render: () => <Controlled initial={EMPTY_ADDRESS} />,
}

export const Filled: Story = {
  render: () => (
    <Controlled
      initial={{
        street: 'Av. San Martín', number: '1234', floor: '3', apartment: 'B',
        city: 'Mendoza', province: 'Mendoza', postal_code: '5500', country: 'Argentina',
      }}
    />
  ),
}

export const RequiredCore: Story = {
  render: () => <Controlled initial={EMPTY_ADDRESS} requireCore />,
}

export const WithErrors: Story = {
  render: () => (
    <Controlled
      initial={EMPTY_ADDRESS}
      requireCore
      errors={{ street: 'La calle es obligatoria', city: 'La ciudad es obligatoria', province: 'La provincia es obligatoria' }}
    />
  ),
}

export const Disabled: Story = {
  render: () => (
    <Controlled
      initial={{
        street: 'Av. San Martín', number: '1234', floor: '', apartment: '',
        city: 'Mendoza', province: 'Mendoza', postal_code: '5500', country: 'Argentina',
      }}
      disabled
    />
  ),
}
