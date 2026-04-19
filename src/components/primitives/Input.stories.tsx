import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Input } from './Input'

const meta: Meta<typeof Input> = {
  title: 'Primitives/Input',
  component: Input,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof Input>

export const Default: Story = { args: { placeholder: 'Ingresá un valor' } }
export const WithValue: Story = { args: { defaultValue: 'Juan Pérez' } }
export const Error: Story = { args: { error: true, defaultValue: 'valor inválido', placeholder: 'CUIT' } }
export const Disabled: Story = { args: { disabled: true, defaultValue: 'No editable' } }
export const ReadOnly: Story = { args: { readOnly: true, defaultValue: '20-12345678-9' } }
