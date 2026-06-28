'use client'

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import type { Session } from 'next-auth'
import { SessionProvider } from 'next-auth/react'
import { Sidebar } from './Sidebar'
import { SidebarProvider } from './SidebarContext'
import { CapabilitiesProvider } from './CapabilitiesContext'
import { storyCapabilities } from './capabilities.story-fixtures'

const session: Session = {
  user: {
    id: 'u1',
    email: 'op@andiko.test',
    name: 'Vendedor Demo',
    role: 'operator',
    orgId: 'o1',
    branchId: 'b1',
    orgRoleId: 'role-vendedor',
    actingOrgId: null,
    realRole: 'operator',
    realOrgId: 'o1',
    realBranchId: 'b1',
    impersonation: null,
  },
  expires: new Date(Date.now() + 86_400_000).toISOString(),
}

const meta: Meta<typeof Sidebar> = {
  title: 'Layout/Sidebar',
  component: Sidebar,
  tags: ['autodocs'],
  args: {
    userName: 'Vendedor Demo',
    userRole: 'operator',
    isRealSysAdmin: false,
  },
}
export default meta
type Story = StoryObj<typeof Sidebar>

// Desktop: the sidebar is a static 220px column (md:static), always visible.
export const Default: Story = {
  decorators: [
    Story => (
      <SessionProvider session={session}>
        <CapabilitiesProvider initial={storyCapabilities}>
          <SidebarProvider>
            <div className="flex h-screen bg-surface-muted">
              <Story />
            </div>
          </SidebarProvider>
        </CapabilitiesProvider>
      </SessionProvider>
    ),
  ],
}

// Mobile: the sidebar becomes an off-canvas drawer. Shown open over a backdrop.
export const MobileDrawer: Story = {
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  decorators: [
    Story => (
      <SessionProvider session={session}>
        <CapabilitiesProvider initial={storyCapabilities}>
          <SidebarProvider defaultOpen>
            <div className="h-screen bg-surface-muted">
              <Story />
            </div>
          </SidebarProvider>
        </CapabilitiesProvider>
      </SessionProvider>
    ),
  ],
}
