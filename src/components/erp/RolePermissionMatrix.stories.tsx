import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { RolePermissionMatrix } from './RolePermissionMatrix'

const meta: Meta<typeof RolePermissionMatrix> = {
  title: 'ERP/RolePermissionMatrix',
  component: RolePermissionMatrix,
  parameters: { layout: 'padded' },
}

export default meta
type Story = StoryObj<typeof RolePermissionMatrix>

export const ReadOnly: Story = {
  args: {
    orgId: '00000000-0000-4000-8000-000000000001',
    apiNamespace: 'settings',
    canEdit: false,
  },
}
