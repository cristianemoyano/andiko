import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ShipmentStatusBadge } from './ShipmentStatusBadge'
import { SHIPMENT_STATUSES } from '@/modules/logistics/logistics.constants'

const meta: Meta<typeof ShipmentStatusBadge> = {
  title: 'ERP/ShipmentStatusBadge',
  component: ShipmentStatusBadge,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof ShipmentStatusBadge>

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {SHIPMENT_STATUSES.map((s) => (
        <ShipmentStatusBadge key={s} status={s} />
      ))}
    </div>
  ),
}

export const Delivered: Story = { args: { status: 'delivered' } }
export const InTransit: Story = { args: { status: 'in_transit' } }
export const Failed: Story = { args: { status: 'failed' } }
