import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { DataTable } from './DataTable'
import { TablePagination } from './TablePagination'
import { StatusBadge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'

const meta: Meta<typeof DataTable> = {
  title: 'ERP/DataTable',
  component: DataTable,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof DataTable>

type Invoice = {
  id: string
  comprobante: string
  cliente: string
  fecha: string
  vencimiento: string
  monto_neto: string
  total: string
  estado: string
}

const SAMPLE_DATA: Invoice[] = [
  { id: '1', comprobante: 'FC-A 0001-00004532', cliente: 'Distribuidora Sur S.A.', fecha: '12/04/2026', vencimiento: '12/05/2026', monto_neto: '$ 38.000,00', total: '$ 45.980,00', estado: 'Aprobado' },
  { id: '2', comprobante: 'FC-A 0001-00004531', cliente: 'Importaciones Nortex',    fecha: '10/04/2026', vencimiento: '10/05/2026', monto_neto: '$ 12.400,00', total: '$ 15.004,00', estado: 'Pendiente' },
  { id: '3', comprobante: 'FC-B 0001-00000089', cliente: 'Mercado Libre S.A.',      fecha: '08/04/2026', vencimiento: '08/05/2026', monto_neto: '$ 5.800,00',  total: '$ 7.018,00',  estado: 'En proceso' },
  { id: '4', comprobante: 'NC-A 0001-00000012', cliente: 'Distribuidora Sur S.A.', fecha: '05/04/2026', vencimiento: '—',          monto_neto: '− $ 3.200,00', total: '− $ 3.872,00', estado: 'Anulado' },
]

const COLUMNS = [
  { key: 'comprobante', header: 'Comprobante', sortable: true, className: 'font-mono text-[12px]' },
  { key: 'cliente',     header: 'Cliente',     sortable: true },
  { key: 'fecha',       header: 'Fecha',       sortable: true, className: 'text-fg-muted' },
  { key: 'vencimiento', header: 'Vencimiento', sortable: true, className: 'text-fg-muted' },
  { key: 'monto_neto',  header: 'Monto neto',  sortable: true, align: 'right' as const, className: 'font-mono' },
  { key: 'total',       header: 'Total',       sortable: true, align: 'right' as const, className: 'font-mono font-medium' },
  {
    key: 'estado',
    header: 'Estado',
    render: (row: Invoice) => <StatusBadge value={row.estado} />,
  },
]

export const Default: Story = {
  render: () => (
    <DataTable
      columns={COLUMNS}
      data={SAMPLE_DATA}
      keyExtractor={r => r.id}
    />
  ),
}

export const WithToolbar: Story = {
  render: () => (
    <DataTable
      columns={COLUMNS}
      data={SAMPLE_DATA}
      keyExtractor={r => r.id}
      toolbar={
        <>
          <div className="relative flex items-center">
            <svg className="absolute left-2 text-fg-subtle" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/>
            </svg>
            <input
              className="pl-7 pr-3 h-[30px] text-[13px] border border-border-strong rounded-sm w-52 focus:outline-none focus:border-ring"
              placeholder="Buscar facturas…"
            />
          </div>
          <Button variant="secondary" size="xs">Filtros</Button>
          <span className="flex-1" />
          <span className="text-[12px] text-fg-muted">{SAMPLE_DATA.length} registros</span>
          <Button variant="secondary" size="xs">Exportar</Button>
          <Button size="xs">+ Nueva factura</Button>
        </>
      }
      footer={
        <>
          <span>Monto neto:</span>
          <span className="font-mono font-semibold text-fg">$ 53.000,00</span>
          <span>Total:</span>
          <span className="font-mono font-bold text-fg text-[13px]">$ 64.130,00</span>
        </>
      }
    />
  ),
}

export const Empty: Story = {
  render: () => (
    <DataTable
      columns={COLUMNS}
      data={[]}
      keyExtractor={r => r.id}
      emptyMessage="No se encontraron facturas."
    />
  ),
}

function DataTableWithPagination() {
  const [page, setPage] = useState(1)
  const pageSize = 2
  const total = SAMPLE_DATA.length
  const slice = SAMPLE_DATA.slice((page - 1) * pageSize, page * pageSize)
  return (
    <DataTable
      columns={COLUMNS}
      data={slice}
      keyExtractor={r => r.id}
      toolbar={<span className="text-[12px] text-fg-muted">Ejemplo: {total} filas, {pageSize} por página</span>}
      footer={<TablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />}
    />
  )
}

export const WithPaginationFooter: Story = {
  name: 'Con paginación en footer',
  render: () => <DataTableWithPagination />,
}
