'use client'

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { KpiInfoIcon, KpiLabel } from './KpiInfoIcon'

const meta: Meta<typeof KpiInfoIcon> = {
  title: 'ERP/KpiInfoIcon',
  component: KpiInfoIcon,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
}
export default meta
type Story = StoryObj<typeof KpiInfoIcon>

export const Default: Story = {
  args: {
    content: 'Suma del total de facturas emitidas en el período. Incluye IVA.',
  },
}

export const WithLabel: StoryObj<typeof KpiLabel> = {
  render: () => (
    <KpiLabel
      label="Ventas netas"
      info="Suma del subtotal de facturas (cantidad × precio unitario), sin IVA ni descuentos de línea."
      labelClassName="text-[11px] text-fg-muted"
    />
  ),
}
