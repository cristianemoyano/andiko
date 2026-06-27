import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Badge, StatusBadge } from './Badge'

const meta: Meta<typeof Badge> = {
  title: 'Primitives/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    status: { control: 'select', options: ['success', 'pending', 'error', 'draft', 'info', 'neutral'] },
    dot:    { control: 'boolean' },
  },
}
export default meta
type Story = StoryObj<typeof Badge>

export const Default: Story = { args: { children: 'Factura A', status: 'neutral' } }

export const DocumentStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <StatusBadge value="Aprobado" />
      <StatusBadge value="Pendiente" />
      <StatusBadge value="Anulado" />
      <StatusBadge value="Borrador" />
      <StatusBadge value="En proceso" />
    </div>
  ),
}

export const BillingStatuses: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <StatusBadge value="Activa" />
        <StatusBadge value="Prueba" />
        <StatusBadge value="Vencida" />
        <StatusBadge value="Pausada" />
        <StatusBadge value="Cancelada" />
      </div>
      <div className="flex flex-wrap gap-2">
        <StatusBadge value="Borrador" />
        <StatusBadge value="Emitida" />
        <StatusBadge value="Pago parcial" />
        <StatusBadge value="Pagada" />
        <StatusBadge value="Anulada" />
      </div>
    </div>
  ),
}

export const TypeTags: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge status="neutral">Factura A</Badge>
      <Badge status="neutral">Factura B</Badge>
      <Badge status="neutral">Nota de Crédito</Badge>
      <Badge status="neutral">Remito</Badge>
    </div>
  ),
}

export const IVATags: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge status="info">IVA 21%</Badge>
      <Badge status="info">IVA 10.5%</Badge>
      <Badge status="neutral">Exento</Badge>
      <Badge status="neutral">No gravado</Badge>
    </div>
  ),
}

export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge status="success" dot>Aprobado</Badge>
      <Badge status="pending" dot>Pendiente</Badge>
      <Badge status="error"   dot>Anulado</Badge>
      <Badge status="draft"   dot>Borrador</Badge>
      <Badge status="info"    dot>En proceso</Badge>
    </div>
  ),
}
