import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { SalesWorkflowHelp } from './SalesWorkflowHelp'

const meta: Meta<typeof SalesWorkflowHelp> = {
  title: 'ERP/SalesWorkflowHelp',
  component: SalesWorkflowHelp,
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof SalesWorkflowHelp>

export const IconOnly: Story = {
  args: { label: null },
}

export const WithLabel: Story = {
  args: { label: 'Flujo de ventas' },
}
