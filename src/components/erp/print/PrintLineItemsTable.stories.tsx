import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PrintLineItemsTable } from './PrintLineItemsTable'
import { samplePrintableQuote } from './print-document.fixture'

const meta: Meta<typeof PrintLineItemsTable> = {
  title: 'ERP/Print/PrintLineItemsTable',
  component: PrintLineItemsTable,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof PrintLineItemsTable>

export const WithTax: Story = {
  args: { lines: samplePrintableQuote.lines, showTaxColumns: true },
}

export const ReceiptStyle: Story = {
  args: {
    lines: [
      {
        description: 'Ítem recepción',
        quantity: '10',
        unit_price: '125.50',
        discount_pct: null,
        iva_rate: null,
        subtotal: null,
        discount_amount: null,
        tax_amount: null,
        total: null,
      },
    ],
    showTaxColumns: false,
  },
}
