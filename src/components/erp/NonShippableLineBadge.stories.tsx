import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { NonShippableLineBadge } from './NonShippableLineBadge'

const meta: Meta<typeof NonShippableLineBadge> = {
  title: 'ERP/NonShippableLineBadge',
  component: NonShippableLineBadge,
}

export default meta
type Story = StoryObj<typeof NonShippableLineBadge>

export const Default: Story = {
  render: () => (
    <p className="text-[13px] text-fg">
      Consultoría (hora)
      <NonShippableLineBadge />
    </p>
  ),
}
