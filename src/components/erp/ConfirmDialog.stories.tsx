'use client'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import { Button } from '@/components/primitives/Button'

const meta: Meta<typeof ConfirmDialog> = {
  title: 'ERP/ConfirmDialog',
  component: ConfirmDialog,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof ConfirmDialog>

export const DeleteContact: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button variant="danger" onClick={() => setOpen(true)}>Eliminar contacto</Button>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Eliminar contacto"
          description="Esta acción eliminará el contacto permanentemente. Los documentos relacionados no se verán afectados."
          onConfirm={() => new Promise(r => setTimeout(r, 1000))}
          confirmLabel="Eliminar contacto"
        />
      </>
    )
  },
}

export const CancelInvoice: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button variant="secondary" onClick={() => setOpen(true)}>Anular factura</Button>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Anular factura"
          description="Al anular la factura FAC-0042 no podrás volver a emitirla. Deberás crear una nueva factura si es necesario."
          onConfirm={async () => {}}
          variant="warning"
          confirmLabel="Anular factura"
        />
      </>
    )
  },
}

export const QuickConfirm: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Confirmar pedido</Button>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Confirmar pedido"
          description="El pedido PED-0015 pasará a estado Confirmado y no podrá editarse."
          onConfirm={async () => {}}
          variant="warning"
          confirmLabel="Confirmar"
        />
      </>
    )
  },
}
