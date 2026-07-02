import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PartialShipmentBadge } from './PartialShipmentBadge'

const meta: Meta<typeof PartialShipmentBadge> = {
  title: 'ERP/PartialShipmentBadge',
  component: PartialShipmentBadge,
}

export default meta
type Story = StoryObj<typeof PartialShipmentBadge>

export const Default: Story = {}
