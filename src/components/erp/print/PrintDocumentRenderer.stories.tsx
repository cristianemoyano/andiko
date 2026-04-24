import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PrintDocumentRenderer } from './PrintDocumentRenderer'
import { samplePrintableInvoice, samplePrintableQuote } from './print-document.fixture'

const meta: Meta<typeof PrintDocumentRenderer> = {
  title: 'ERP/Print/PrintDocumentRenderer',
  component: PrintDocumentRenderer,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof PrintDocumentRenderer>

export const Quote: Story = {
  args: { document: samplePrintableQuote },
}

export const InvoiceWithPayments: Story = {
  args: { document: samplePrintableInvoice },
}
