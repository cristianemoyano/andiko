import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { SalesOrderChannelBadge } from './SalesOrderChannelBadge'

const meta: Meta<typeof SalesOrderChannelBadge> = {
  title: 'ERP/SalesOrderChannelBadge',
  component: SalesOrderChannelBadge,
}

export default meta
type Story = StoryObj<typeof SalesOrderChannelBadge>

export const Cloud: Story = {
  args: { source: 'erp' },
}

export const Pos: Story = {
  args: { source: 'pos' },
}

export const WooCommerce: Story = {
  args: { source: 'woocommerce' },
}

export const Unknown: Story = {
  args: { source: null },
}
