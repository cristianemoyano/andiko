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
  args: { screen: 'sales-invoice', showJournalEntriesLink: true, showDivider: false },
}

export const PurchaseInvoice: Story = {
  args: { screen: 'purchase-invoice', showJournalEntriesLink: true, showDivider: false },
}

export const PurchasePayment: Story = {
  args: { screen: 'purchase-payment', showDivider: false },
}

export const JournalEntries: Story = {
  args: { screen: 'journal-entries' },
}

export const WithDivider: Story = {
  args: { screen: 'purchase-payment' },
}
