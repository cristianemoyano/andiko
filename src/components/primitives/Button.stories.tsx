import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Button } from './Button'

const meta: Meta<typeof Button> = {
  title: 'Primitives/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size:    { control: 'select', options: ['sm', 'md', 'lg'] },
  },
}
export default meta
type Story = StoryObj<typeof Button>

export const Primary: Story = { args: { children: 'Guardar', variant: 'primary' } }
export const Secondary: Story = { args: { children: 'Cancelar', variant: 'secondary' } }
export const Ghost: Story = { args: { children: 'Ver detalle', variant: 'ghost' } }
export const Danger: Story = { args: { children: 'Eliminar', variant: 'danger' } }

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button size="sm">Pequeño</Button>
      <Button size="md">Mediano</Button>
      <Button size="lg">Grande</Button>
    </div>
  ),
}

export const Disabled: Story = {
  render: () => (
    <div className="flex gap-3">
      <Button disabled>Primary</Button>
      <Button variant="secondary" disabled>Secondary</Button>
      <Button variant="danger" disabled>Danger</Button>
    </div>
  ),
}

export const LongText: Story = { args: { children: 'Confirmar y emitir factura electrónica AFIP' } }
