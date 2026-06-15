'use client'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { Switch } from './Switch'

const meta: Meta<typeof Switch> = {
  title: 'Primitives/Switch',
  component: Switch,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['sm', 'md'] },
  },
}
export default meta
type Story = StoryObj<typeof Switch>

export const Default: Story = {
  args: { label: 'Facturación electrónica' },
}

export const Checked: Story = {
  args: { label: 'Sucursal activa', defaultChecked: true },
}

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Switch size="sm" label="Tamaño sm" defaultChecked />
      <Switch size="md" label="Tamaño md" defaultChecked />
    </div>
  ),
}

export const WithoutLabel: Story = {
  render: () => <Switch aria-label="Activar notificaciones" />,
}

export const Disabled: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Switch label="Deshabilitado apagado" disabled />
      <Switch label="Deshabilitado encendido" disabled defaultChecked />
    </div>
  ),
}

export const Controlled: Story = {
  render: () => {
    const [enabled, setEnabled] = useState(false)
    return (
      <div className="flex flex-col gap-2">
        <Switch label="Notificar vencimientos" checked={enabled} onCheckedChange={setEnabled} />
        <p className="text-[11px] text-fg-muted">Estado: {enabled ? 'activado' : 'desactivado'}</p>
      </div>
    )
  },
}

export const LongLabel: Story = {
  args: {
    label:
      'Habilitar el envío automático de comprobantes por correo electrónico al cliente al confirmar cada factura',
    className: 'max-w-sm',
  },
}
