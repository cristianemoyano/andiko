import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PrintDraftBanner } from './PrintDraftBanner'

const meta: Meta<typeof PrintDraftBanner> = {
  title: 'ERP/Print/PrintDraftBanner',
  component: PrintDraftBanner,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof PrintDraftBanner>

export const Default: Story = {}
