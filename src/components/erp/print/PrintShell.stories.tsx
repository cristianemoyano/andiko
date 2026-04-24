import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PrintShell } from './PrintShell'
import { PrintLineItemsTable } from './PrintLineItemsTable'
import { PrintTotalsBlock } from './PrintTotalsBlock'
import { samplePrintableInvoice, samplePrintableQuote } from './print-document.fixture'

const meta: Meta<typeof PrintShell> = {
  title: 'ERP/Print/PrintShell',
  component: PrintShell,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof PrintShell>

export const QuoteDraft: Story = {
  render: () => (
    <PrintShell document={samplePrintableQuote}>
      <PrintLineItemsTable lines={samplePrintableQuote.lines} />
      <PrintTotalsBlock totals={samplePrintableQuote.totals} />
    </PrintShell>
  ),
}

export const InvoiceIssued: Story = {
  render: () => (
    <PrintShell document={samplePrintableInvoice}>
      <PrintLineItemsTable lines={samplePrintableInvoice.lines} />
      <PrintTotalsBlock totals={samplePrintableInvoice.totals} />
    </PrintShell>
  ),
}
