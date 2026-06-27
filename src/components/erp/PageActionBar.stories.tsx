'use client'

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PageActionBar } from './PageActionBar'

const meta: Meta<typeof PageActionBar> = {
  title: 'ERP/PageActionBar',
  component: PageActionBar,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof PageActionBar>

export const PrimaryWithSecondary: Story = {
  render: () => (
    <PageActionBar
      primary={{ id: 'convert', label: 'Crear factura', onClick: () => undefined }}
      secondary={[
        { id: 'print', label: 'Imprimir', href: '/ventas/facturas/1/print', openInNewTab: true },
        { id: 'email', label: 'Enviar por email', onClick: () => undefined },
        { id: 'cancel', label: 'Anular', onClick: () => undefined, variant: 'destructive' },
      ]}
    />
  ),
}

export const SecondaryOnly: Story = {
  render: () => (
    <PageActionBar
      secondary={[
        { id: 'print', label: 'Imprimir', href: '#' },
        { id: 'email', label: 'Enviar por email', onClick: () => undefined },
        { id: 'cancel', label: 'Anular', onClick: () => undefined, variant: 'destructive' },
      ]}
    />
  ),
}

export const EditMode: Story = {
  render: () => (
    <PageActionBar
      edit={{
        onCancel: () => undefined,
        onSave: () => undefined,
        saving: false,
      }}
    />
  ),
}

export const PrimaryOnly: Story = {
  render: () => (
    <PageActionBar
      primary={{ id: 'new', label: '+ Nuevo pedido', onClick: () => undefined }}
    />
  ),
}
