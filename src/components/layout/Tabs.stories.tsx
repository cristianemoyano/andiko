'use client'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs'
import { Badge } from '@/components/primitives/Badge'

const meta: Meta<typeof Tabs> = {
  title: 'Layout/Tabs',
  component: Tabs,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof Tabs>

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="general" className="max-w-xl">
      <TabsList aria-label="Secciones del contacto">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="fiscal">Datos fiscales</TabsTrigger>
        <TabsTrigger value="cuenta">Cuenta corriente</TabsTrigger>
      </TabsList>
      <TabsContent value="general">
        <p className="text-[13px] text-zinc-600">Razón social, contacto y dirección.</p>
      </TabsContent>
      <TabsContent value="fiscal">
        <p className="text-[13px] text-zinc-600">CUIT, condición frente al IVA, ingresos brutos.</p>
      </TabsContent>
      <TabsContent value="cuenta">
        <p className="text-[13px] text-zinc-600">Saldo, movimientos y límite de crédito.</p>
      </TabsContent>
    </Tabs>
  ),
}

export const WithDisabledTab: Story = {
  render: () => (
    <Tabs defaultValue="detalle" className="max-w-xl">
      <TabsList aria-label="Secciones de la factura">
        <TabsTrigger value="detalle">Detalle</TabsTrigger>
        <TabsTrigger value="pagos">Pagos</TabsTrigger>
        <TabsTrigger value="afip" disabled>
          AFIP (no autorizado)
        </TabsTrigger>
      </TabsList>
      <TabsContent value="detalle">
        <p className="text-[13px] text-zinc-600">Ítems del comprobante.</p>
      </TabsContent>
      <TabsContent value="pagos">
        <p className="text-[13px] text-zinc-600">Pagos aplicados al comprobante.</p>
      </TabsContent>
      <TabsContent value="afip">
        <p className="text-[13px] text-zinc-600">CAE y datos de autorización.</p>
      </TabsContent>
    </Tabs>
  ),
}

export const WithBadges: Story = {
  render: () => (
    <Tabs defaultValue="pendientes" className="max-w-xl">
      <TabsList aria-label="Estados de comprobantes">
        <TabsTrigger value="pendientes" className="flex items-center gap-1.5">
          Pendientes
          <Badge status="pending">12</Badge>
        </TabsTrigger>
        <TabsTrigger value="aprobados" className="flex items-center gap-1.5">
          Aprobados
          <Badge status="success">48</Badge>
        </TabsTrigger>
        <TabsTrigger value="anulados" className="flex items-center gap-1.5">
          Anulados
          <Badge status="error">3</Badge>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="pendientes">
        <p className="text-[13px] text-zinc-600">12 comprobantes pendientes.</p>
      </TabsContent>
      <TabsContent value="aprobados">
        <p className="text-[13px] text-zinc-600">48 comprobantes aprobados.</p>
      </TabsContent>
      <TabsContent value="anulados">
        <p className="text-[13px] text-zinc-600">3 comprobantes anulados.</p>
      </TabsContent>
    </Tabs>
  ),
}

export const ManyTabsLongLabels: Story = {
  render: () => (
    <Tabs defaultValue="t1" className="max-w-xl">
      <TabsList aria-label="Muchas pestañas" className="overflow-x-auto">
        <TabsTrigger value="t1">Presupuestos del período</TabsTrigger>
        <TabsTrigger value="t2">Pedidos confirmados</TabsTrigger>
        <TabsTrigger value="t3">Facturas emitidas y autorizadas</TabsTrigger>
        <TabsTrigger value="t4">Notas de crédito</TabsTrigger>
        <TabsTrigger value="t5">Cuenta corriente consolidada</TabsTrigger>
      </TabsList>
      <TabsContent value="t1">
        <p className="text-[13px] text-zinc-600">Contenido de la primera pestaña.</p>
      </TabsContent>
      <TabsContent value="t2">
        <p className="text-[13px] text-zinc-600">Contenido de la segunda pestaña.</p>
      </TabsContent>
      <TabsContent value="t3">
        <p className="text-[13px] text-zinc-600">Contenido de la tercera pestaña.</p>
      </TabsContent>
      <TabsContent value="t4">
        <p className="text-[13px] text-zinc-600">Contenido de la cuarta pestaña.</p>
      </TabsContent>
      <TabsContent value="t5">
        <p className="text-[13px] text-zinc-600">Contenido de la quinta pestaña.</p>
      </TabsContent>
    </Tabs>
  ),
}
