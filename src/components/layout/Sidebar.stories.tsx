'use client'

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import type { Session } from 'next-auth'
import { SessionProvider } from 'next-auth/react'
import { Sidebar } from './Sidebar'
import { SidebarProvider } from './SidebarContext'
import { CapabilitiesProvider } from './CapabilitiesContext'
import { TopBar } from './TopBar'
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
    isRealSysAdmin: false,
  },
}
export default meta
type Story = StoryObj<typeof Sidebar>

function ShellFrame({
  children,
  defaultCollapsed = false,
}: {
  children: React.ReactNode
  defaultCollapsed?: boolean
}) {
  return (
    <SessionProvider session={session}>
      <CapabilitiesProvider initial={storyCapabilities}>
        <SidebarProvider defaultCollapsed={defaultCollapsed} persistCollapsed={false}>
          <div className="flex h-screen bg-bg">
            {children}
            <div className="flex min-w-0 flex-1 flex-col">
              <TopBar
                breadcrumbs={[{ label: 'Panel' }]}
                userName="Vendedor Demo"
                userRole="operator"
              />
              <div className="flex-1 p-5 text-sm text-fg-muted">Contenido de página</div>
            </div>
          </div>
        </SidebarProvider>
      </CapabilitiesProvider>
    </SessionProvider>
  )
}

// Desktop: expanded sidebar + top bar chrome
export const Default: Story = {
  decorators: [
    Story => (
      <ShellFrame>
        <Story />
      </ShellFrame>
    ),
  ],
}

// Desktop: collapsed icon rail
export const Collapsed: Story = {
  decorators: [
    Story => (
      <ShellFrame defaultCollapsed>
        <Story />
      </ShellFrame>
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
