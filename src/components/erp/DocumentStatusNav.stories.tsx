import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { DocumentStatusNav } from './DocumentStatusNav'

const meta: Meta<typeof DocumentStatusNav> = {
  title: 'ERP/DocumentStatusNav',
  component: DocumentStatusNav,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof DocumentStatusNav>

const tabs = [
  { key: '', label: 'Todos' },
  { key: 'draft', label: 'Borrador' },
  { key: 'confirmed', label: 'Confirmado' },
  { key: 'cancelled', label: 'Cancelado' },
] as const

function StatefulStatusNav() {
  const [active, setActive] = useState<'' | 'draft' | 'confirmed' | 'cancelled'>('')
  return (
    <DocumentStatusNav
      tabs={tabs}
      active={active}
      counts={{ '': 28, draft: 5, confirmed: 21, cancelled: 2 }}
      onChange={setActive}
      ariaLabel="Filtrar documentos por estado"
    />
  )
}

export const Default: Story = {
  render: () => <StatefulStatusNav />,
}
