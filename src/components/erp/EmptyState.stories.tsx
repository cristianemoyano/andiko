import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { EmptyState } from './EmptyState'

const meta: Meta<typeof EmptyState> = {
  title: 'ERP/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof EmptyState>

export const Default: Story = {
  args: {
    title: 'Sin facturas',
    description: 'Todavía no hay facturas registradas. Creá la primera para comenzar.',
    action: { label: 'Nueva factura', onClick: () => {} },
  },
}

export const NoAction: Story = {
  args: {
    title: 'Sin resultados',
    description: 'No se encontraron contactos que coincidan con tu búsqueda.',
  },
}

export const WithCustomIcon: Story = {
  args: {
    title: 'Sin presupuestos',
    description: 'Los presupuestos enviados aparecerán aquí.',
    action: { label: 'Crear presupuesto', onClick: () => {} },
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand-400">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
}

export const InTable: Story = {
  render: () => (
    <div className="rounded-sm border border-zinc-200">
      <div className="border-b border-zinc-100 px-4 py-2 text-[12px] font-medium text-zinc-500 bg-zinc-50">
        COBROS
      </div>
      <EmptyState
        title="Sin cobros registrados"
        description="Registrá el primer cobro para actualizar el saldo de esta factura."
        action={{ label: 'Registrar cobro', onClick: () => {} }}
        className="py-12"
      />
    </div>
  ),
}
