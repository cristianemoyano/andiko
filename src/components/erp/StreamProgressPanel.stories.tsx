import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { StreamProgressPanel } from './StreamProgressPanel'

const meta: Meta<typeof StreamProgressPanel> = {
  title: 'ERP/StreamProgressPanel',
  component: StreamProgressPanel,
}

export default meta
type Story = StoryObj<typeof StreamProgressPanel>

export const InProgress: Story = {
  args: {
    title: 'Publicando catálogo…',
    unitLabel: 'variantes',
    processed: 2400,
    total: 8000,
    eta: '~3 min restantes',
    hint: 'Enviando productos a WooCommerce.',
  },
}

export const Complete: Story = {
  args: {
    title: 'Publicando catálogo…',
    unitLabel: 'variantes',
    processed: 8000,
    total: 8000,
  },
}

export const WithCancel: Story = {
  args: {
    title: 'Publicando catálogo…',
    unitLabel: 'variantes',
    processed: 61,
    total: 8662,
    eta: '~129 min restantes',
    hint: 'Enviando productos a WooCommerce.',
    cancelLabel: 'Cancelar publicación',
    onCancel: () => undefined,
  },
}
