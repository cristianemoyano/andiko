import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Skeleton } from './Skeleton'

const meta: Meta<typeof Skeleton> = {
  title: 'Primitives/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  argTypes: {
    shape: { control: 'select', options: ['line', 'block', 'circle'] },
  },
}
export default meta
type Story = StoryObj<typeof Skeleton>

export const Default: Story = {
  args: { shape: 'line', className: 'h-4 w-40' },
}

export const Shapes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Skeleton shape="line" className="h-4 w-40" />
      <Skeleton shape="block" className="h-16 w-24" />
      <Skeleton shape="circle" className="h-10 w-10" />
    </div>
  ),
}

export const KpiCard: Story = {
  render: () => (
    <div className="bg-surface border border-border rounded-[4px] p-4 flex flex-col gap-2 w-64">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-6 w-36" />
      <Skeleton className="h-3 w-28" />
    </div>
  ),
}

export const TableRows: Story = {
  render: () => (
    <div className="flex flex-col gap-2 w-80">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  ),
}
