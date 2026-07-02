import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ORDER_STATUSES } from '@/modules/sales/sales-order.model'
import { OrderStatusBadge } from './OrderStatusBadge'

const meta: Meta<typeof OrderStatusBadge> = {
  title: 'ERP/OrderStatusBadge',
  component: OrderStatusBadge,
}

export default meta
type Story = StoryObj<typeof OrderStatusBadge>

export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2 p-4">
      {ORDER_STATUSES.map(status => (
        <OrderStatusBadge key={status} status={status} />
      ))}
    </div>
  ),
}
