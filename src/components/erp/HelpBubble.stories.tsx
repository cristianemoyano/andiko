'use client'

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import Link from 'next/link'
import { HelpBubble } from './HelpBubble'

const meta: Meta<typeof HelpBubble> = {
  title: 'ERP/HelpBubble',
  component: HelpBubble,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
}
export default meta
type Story = StoryObj<typeof HelpBubble>

export const Default: Story = {
  args: {
    title: 'Stock por depósito',
    children: (
      <p>
        Vista de saldos reales por variante y depósito. Filtrá por ubicación y configurá mínimos en masa.
      </p>
    ),
  },
}

export const WithLabel: Story = {
  args: {
    label: 'Stock',
    title: 'Stock por depósito',
    children: (
      <p>
        Vista de saldos reales por variante y depósito. Filtrá por ubicación y configurá mínimos en masa.
      </p>
    ),
  },
}

export const WithLink: Story = {
  render: () => (
    <HelpBubble label="Stock" title="Stock en el catálogo">
      <p>El número del catálogo es la suma de todos los depósitos.</p>
      <p>
        <Link href="/inventario/stock" className="text-brand-600 hover:underline font-medium">
          Ver stock por depósito →
        </Link>
      </p>
    </HelpBubble>
  ),
}
