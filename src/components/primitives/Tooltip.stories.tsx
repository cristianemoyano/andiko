'use client'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Tooltip, TooltipProvider } from './Tooltip'
import { Button } from './Button'
import { Badge } from './Badge'

const meta: Meta<typeof Tooltip> = {
  title: 'Primitives/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  argTypes: {
    side: { control: 'select', options: ['top', 'right', 'bottom', 'left'] },
    align: { control: 'select', options: ['start', 'center', 'end'] },
  },
}
export default meta
type Story = StoryObj<typeof Tooltip>

export const Default: Story = {
  render: () => (
    <div className="flex justify-center p-12">
      <Tooltip content="Emitir factura electrónica">
        <Button variant="secondary">Facturar</Button>
      </Tooltip>
    </div>
  ),
}

export const Placements: Story = {
  render: () => (
    <TooltipProvider>
      <div className="flex items-center justify-center gap-4 p-16">
        <Tooltip content="Arriba" side="top">
          <Button variant="secondary" size="xs">top</Button>
        </Tooltip>
        <Tooltip content="Derecha" side="right">
          <Button variant="secondary" size="xs">right</Button>
        </Tooltip>
        <Tooltip content="Abajo" side="bottom">
          <Button variant="secondary" size="xs">bottom</Button>
        </Tooltip>
        <Tooltip content="Izquierda" side="left">
          <Button variant="secondary" size="xs">left</Button>
        </Tooltip>
      </div>
    </TooltipProvider>
  ),
}

export const OnNonButtonElement: Story = {
  render: () => (
    <div className="flex justify-center p-12">
      <Tooltip content="Comprobante autorizado por AFIP el 05/06/2026">
        <Badge status="success" dot tabIndex={0}>Aprobado</Badge>
      </Tooltip>
    </div>
  ),
}

export const LongContent: Story = {
  render: () => (
    <div className="flex justify-center p-12">
      <Tooltip content="El CAE (Código de Autorización Electrónico) es otorgado por AFIP al autorizar el comprobante. Sin CAE la factura no tiene validez fiscal y no puede entregarse al cliente.">
        <Button variant="ghost" size="xs" aria-label="Ayuda sobre CAE">?</Button>
      </Tooltip>
    </div>
  ),
}

export const EmptyContentRendersNothing: Story = {
  render: () => (
    <div className="flex justify-center p-12">
      <Tooltip content="">
        <Button variant="secondary">Sin tooltip (contenido vacío)</Button>
      </Tooltip>
    </div>
  ),
}

export const InstantOpen: Story = {
  render: () => (
    <div className="flex justify-center p-12">
      <Tooltip content="Sin demora (delayDuration=0)" delayDuration={0}>
        <Button variant="secondary">Hover inmediato</Button>
      </Tooltip>
    </div>
  ),
}
