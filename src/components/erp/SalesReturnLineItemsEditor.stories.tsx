import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Input } from '@/components/primitives/Input'
import { FormField } from '@/components/primitives/FormField'

/** Line editor for return quantities — full wizard lives in NuevaDevolucionClient. */
function SalesReturnLineItemsEditorDemo() {
  return (
    <div className="max-w-md flex flex-col gap-3 p-4 bg-surface border border-border rounded-sm">
      <FormField label="Producto A (máx 2)" htmlFor="demo-a">
        <Input id="demo-a" type="number" defaultValue="1" />
      </FormField>
      <FormField label="Producto B (máx 5)" htmlFor="demo-b">
        <Input id="demo-b" type="number" defaultValue="0" />
      </FormField>
    </div>
  )
}

const meta: Meta<typeof SalesReturnLineItemsEditorDemo> = {
  title: 'ERP/SalesReturnLineItemsEditor',
  component: SalesReturnLineItemsEditorDemo,
}

export default meta
type Story = StoryObj<typeof SalesReturnLineItemsEditorDemo>

export const Default: Story = {}
