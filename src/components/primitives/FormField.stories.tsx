import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { FormField } from './FormField'
import { Input } from './Input'

const meta: Meta<typeof FormField> = {
  title: 'Primitives/FormField',
  component: FormField,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof FormField>

export const Default: Story = {
  render: () => (
    <FormField label="Email" htmlFor="email">
      <Input id="email" type="email" placeholder="usuario@empresa.com" />
    </FormField>
  ),
}

export const Required: Story = {
  render: () => (
    <FormField label="CUIT" htmlFor="cuit" required>
      <Input id="cuit" placeholder="20-12345678-9" />
    </FormField>
  ),
}

export const WithError: Story = {
  render: () => (
    <FormField label="CUIT" htmlFor="cuit-error" required error="El CUIT ingresado no es válido">
      <Input id="cuit-error" error defaultValue="20-999" />
    </FormField>
  ),
}

export const CompleteForm: Story = {
  render: () => (
    <div className="flex flex-col gap-4 max-w-sm">
      <FormField label="Nombre" htmlFor="name" required>
        <Input id="name" placeholder="Razón social" />
      </FormField>
      <FormField label="CUIT" htmlFor="cuit-form" required>
        <Input id="cuit-form" placeholder="20-12345678-9" />
      </FormField>
      <FormField label="Email" htmlFor="email-form" error="El email ya está registrado">
        <Input id="email-form" error defaultValue="juan@empresa.com" />
      </FormField>
    </div>
  ),
}
