'use client'

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { BottomNav } from './BottomNav'
import { SidebarProvider } from './SidebarContext'

const meta: Meta<typeof BottomNav> = {
  title: 'Layout/BottomNav',
  component: BottomNav,
  tags: ['autodocs'],
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  decorators: [
    Story => (
      <SidebarProvider>
        <div className="h-screen bg-surface-muted">
          <Story />
        </div>
      </SidebarProvider>
    ),
  ],
}
export default meta
type Story = StoryObj<typeof BottomNav>

// Primary tabs (Panel · Ventas · Productos) plus the Menú tab.
export const Default: Story = {}

// When the org only has some modules enabled, disabled tabs are hidden.
export const LimitedModules: Story = {
  args: { enabledModules: ['sales', 'catalog'] },
}
