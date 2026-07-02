'use client'

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { Sheet } from './Sheet'
import { Button } from './Button'

const meta: Meta<typeof Sheet> = {
  title: 'Primitives/Sheet',
  component: Sheet,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof Sheet>

export const Default: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button onClick={() => setOpen(true)}>Abrir panel</Button>
        <Sheet
          open={open}
          onOpenChange={setOpen}
          title="Detalle del movimiento"
          description="Panel lateral para consultar sin salir de la pantalla."
        >
          <p className="text-[13px] text-fg-muted">
            Contenido del panel lateral. En cuenta corriente se usa para ver el comprobante vinculado.
          </p>
        </Sheet>
      </>
    )
  },
}
