import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Card, CardHeader, CardContent, CardFooter } from './Card'
import { Button } from '@/components/primitives/Button'
import { Badge } from '@/components/primitives/Badge'

const meta: Meta<typeof Card> = {
  title: 'Layout/Card',
  component: Card,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'elevated'] },
  },
}
export default meta
type Story = StoryObj<typeof Card>

export const Default: Story = {
  render: () => (
    <Card className="max-w-md">
      <CardHeader title="Datos fiscales" description="Información impositiva del contacto." />
      <CardContent>
        <dl className="grid grid-cols-2 gap-y-2 text-[13px]">
          <dt className="text-fg-muted">CUIT</dt>
          <dd className="text-fg">30-71234567-8</dd>
          <dt className="text-fg-muted">Condición IVA</dt>
          <dd className="text-fg">Responsable Inscripto</dd>
        </dl>
      </CardContent>
    </Card>
  ),
}

export const Elevated: Story = {
  render: () => (
    <Card variant="elevated" className="max-w-md">
      <CardHeader title="Resumen del mes" />
      <CardContent>
        <p className="text-[13px] text-fg-muted">Total facturado: $ 1.245.300,50</p>
      </CardContent>
    </Card>
  ),
}

export const WithActions: Story = {
  render: () => (
    <Card className="max-w-md">
      <CardHeader
        title="Cuenta corriente"
        description="Saldo y movimientos del cliente."
        actions={
          <>
            <Badge status="pending" dot>Saldo deudor</Badge>
            <Button variant="secondary" size="xs">Exportar</Button>
          </>
        }
      />
      <CardContent>
        <p className="text-[13px] text-fg-muted">Saldo actual: $ 152.420,00</p>
      </CardContent>
    </Card>
  ),
}

export const WithFooter: Story = {
  render: () => (
    <Card className="max-w-md">
      <CardHeader title="Nueva sucursal" />
      <CardContent>
        <p className="text-[13px] text-fg-muted">Completá los datos para crear la sucursal.</p>
      </CardContent>
      <CardFooter>
        <Button variant="secondary" size="sm">Cancelar</Button>
        <Button size="sm">Guardar</Button>
      </CardFooter>
    </Card>
  ),
}

export const ContentOnly: Story = {
  render: () => (
    <Card className="max-w-md">
      <CardContent>
        <p className="text-[13px] text-fg-muted">Card sin encabezado ni pie — solo contenido.</p>
      </CardContent>
    </Card>
  ),
}

export const LongTitle: Story = {
  render: () => (
    <Card className="max-w-sm">
      <CardHeader
        title="Comprobantes pendientes de autorización electrónica ante AFIP del período fiscal en curso"
        actions={<Button variant="secondary" size="xs">Reintentar</Button>}
      />
      <CardContent>
        <p className="text-[13px] text-fg-muted">3 comprobantes en cola.</p>
      </CardContent>
    </Card>
  ),
}

export const EmptyContent: Story = {
  render: () => (
    <Card className="max-w-md">
      <CardHeader title="Movimientos" />
      <CardContent>
        <p className="py-6 text-center text-[12px] text-fg-subtle">Sin movimientos registrados.</p>
      </CardContent>
    </Card>
  ),
}
