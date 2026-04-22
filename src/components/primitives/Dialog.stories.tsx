'use client'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { Dialog } from './Dialog'
import { Button } from './Button'
import { Input } from './Input'
import { FormField } from './FormField'

const meta: Meta<typeof Dialog> = {
  title: 'Primitives/Dialog',
  component: Dialog,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof Dialog>

export const Default: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Abrir diálogo</Button>
        <Dialog open={open} onOpenChange={setOpen} title="Nuevo contacto" description="Completá los datos del contacto.">
          <div className="flex flex-col gap-4">
            <FormField label="Razón social" htmlFor="legal" required>
              <Input id="legal" placeholder="Empresa S.A." />
            </FormField>
            <FormField label="CUIT" htmlFor="cuit">
              <Input id="cuit" placeholder="30-00000000-0" />
            </FormField>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => setOpen(false)}>Guardar</Button>
            </div>
          </div>
        </Dialog>
      </>
    )
  },
}

export const SmallSize: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Abrir (sm)</Button>
        <Dialog open={open} onOpenChange={setOpen} title="Confirmar" size="sm">
          <p className="text-[13px] text-zinc-600">¿Estás seguro que querés continuar?</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>No</Button>
            <Button size="sm" onClick={() => setOpen(false)}>Sí</Button>
          </div>
        </Dialog>
      </>
    )
  },
}

export const LargeSize: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Abrir (lg)</Button>
        <Dialog open={open} onOpenChange={setOpen} title="Detalle de factura" size="lg">
          <p className="text-[13px] text-zinc-500">Contenido amplio de la factura…</p>
        </Dialog>
      </>
    )
  },
}
