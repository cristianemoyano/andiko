import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { AfipStatusBadge, type AfipDocStatus } from './AfipStatusBadge'

const meta: Meta<typeof AfipStatusBadge> = {
  title: 'ERP/AfipStatusBadge',
  component: AfipStatusBadge,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof AfipStatusBadge>

const ALL: AfipDocStatus[] = ['not_sent', 'pending', 'authorized', 'rejected', 'contingency']

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {ALL.map((s) => (
        <AfipStatusBadge key={s} status={s} />
      ))}
    </div>
  ),
}

export const Authorized: Story = { args: { status: 'authorized' } }
export const Rejected: Story = { args: { status: 'rejected' } }
export const Contingency: Story = { args: { status: 'contingency' } }
