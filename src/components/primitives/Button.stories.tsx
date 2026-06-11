import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Button } from './Button'

const meta: Meta<typeof Button> = {
  title: 'Primitives/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size:    { control: 'select', options: ['xs', 'sm', 'md', 'lg'] },
  },
}
export default meta
type Story = StoryObj<typeof Button>

export const Primary: Story = { args: { children: 'Crear factura', variant: 'primary' } }
export const Secondary: Story = { args: { children: 'Exportar', variant: 'secondary' } }
export const Ghost: Story = { args: { children: 'Ver detalle', variant: 'ghost' } }
export const Danger: Story = { args: { children: 'Anular', variant: 'danger' } }

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button size="xs">Guardar</Button>
      <Button size="sm">Guardar</Button>
      <Button size="md">Guardar cambios</Button>
      <Button size="lg">Guardar cambios</Button>
    </div>
  ),
}

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button variant="primary">Crear factura</Button>
      <Button variant="secondary">Exportar</Button>
      <Button variant="ghost">Ver detalle</Button>
      <Button variant="danger">Anular</Button>
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
