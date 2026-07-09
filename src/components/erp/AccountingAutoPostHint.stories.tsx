import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { AccountingAutoPostHint } from './AccountingAutoPostHint'

const meta: Meta<typeof AccountingAutoPostHint> = {
  title: 'ERP/AccountingAutoPostHint',
  component: AccountingAutoPostHint,
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof AccountingAutoPostHint>

export const SalesInvoice: Story = {
  args: { screen: 'sales-invoice', showJournalEntriesLink: true },
}

export const PurchaseInvoice: Story = {
  args: { screen: 'purchase-invoice', showJournalEntriesLink: true },
}

export const JournalEntries: Story = {
  args: { screen: 'journal-entries' },
}
