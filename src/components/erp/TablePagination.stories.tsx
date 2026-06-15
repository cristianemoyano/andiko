import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { TablePagination } from './TablePagination'

const meta: Meta<typeof TablePagination> = {
  title: 'ERP/TablePagination',
  component: TablePagination,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof TablePagination>

function StatefulPagination(props: { total: number; pageSize: number; initialPage?: number }) {
  const [page, setPage] = useState(props.initialPage ?? 1)
  return (
    <div className="max-w-md rounded border border-border bg-surface p-4">
      <TablePagination
        page={page}
        pageSize={props.pageSize}
        total={props.total}
        onPageChange={setPage}
      />
      <p className="mt-3 text-[11px] text-fg-subtle">Página en estado: {page}</p>
    </div>
  )
}

export const Default: Story = {
  render: () => <StatefulPagination total={95} pageSize={20} />,
}

export const TwoPages: Story = {
  render: () => <StatefulPagination total={35} pageSize={20} />,
}

export const SinglePage: Story = {
  name: 'Una sola página (botones deshabilitados)',
  render: () => <StatefulPagination total={12} pageSize={20} />,
}

export const LastPage: Story = {
  name: 'Empieza en última página',
  render: () => <StatefulPagination total={95} pageSize={20} initialPage={5} />,
}
