import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { TotalsFooter } from './TotalsFooter'

const meta: Meta<typeof TotalsFooter> = {
  title: 'ERP/TotalsFooter',
  component: TotalsFooter,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof TotalsFooter>

export const SimpleInvoice: Story = {
  args: {
    subtotal: '10000.00',
    taxAmount: '2100.00',
    total:     '12100.00',
  },
  render: (args) => (
    <div className="w-72">
      <TotalsFooter {...args} />
    </div>
  ),
}

export const WithDiscount: Story = {
  args: {
    subtotal:       '10000.00',
    discountAmount: '1000.00',
    taxAmount:      '1890.00',
    total:          '10890.00',
  },
  render: (args) => (
    <div className="w-72">
      <TotalsFooter {...args} />
    </div>
  ),
}

export const WithIvaBreakdown: Story = {
  args: {
    subtotal:  '20000.00',
    taxAmount: '3950.00',
    total:     '23950.00',
    taxBreakdown: [
      { rate: '21', base: '15000.00', amount: '3150.00' },
      { rate: '10.5', base: '5000.00', amount: '525.00' },
      { rate: '0',  base: '0.00',    amount: '275.00' },
    ],
  },
  render: (args) => (
    <div className="w-80">
      <TotalsFooter {...args} />
    </div>
  ),
}

export const ZeroAmount: Story = {
  args: {
    subtotal:  '0.00',
    taxAmount: '0.00',
    total:     '0.00',
  },
  render: (args) => (
    <div className="w-72">
      <TotalsFooter {...args} />
    </div>
  ),
}

export const LargeAmounts: Story = {
  args: {
    subtotal:       '9876543.21',
    discountAmount: '987654.32',
    taxAmount:      '1871151.97',
    total:          '10760040.86',
  },
  render: (args) => (
    <div className="w-80">
      <TotalsFooter {...args} />
    </div>
  ),
}
