import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { WooSyncBadge } from './WooSyncBadge'

const meta: Meta<typeof WooSyncBadge> = {
  title: 'ERP/WooSyncBadge',
  component: WooSyncBadge,
}

export default meta
type Story = StoryObj<typeof WooSyncBadge>

export const Synced: Story = {
  args: { synced: true },
}

export const NotSynced: Story = {
  args: { synced: false },
}
