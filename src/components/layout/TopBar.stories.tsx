'use client'

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import type { Session } from 'next-auth'
import { SessionProvider } from 'next-auth/react'
import { Button } from '@/components/primitives/Button'
import { TopBar } from './TopBar'

const session: Session = {
  user: {
    id: 'u1',
    email: 'op@andiko.test',
    name: 'Cristian Moyano',
    role: 'admin',
    orgId: 'o1',
    branchId: 'b1',
    orgRoleId: 'role-admin',
    actingOrgId: null,
    realRole: 'admin',
    realOrgId: 'o1',
    realBranchId: 'b1',
    impersonation: null,
  },
  expires: new Date(Date.now() + 86_400_000).toISOString(),
}

const meta: Meta<typeof TopBar> = {
  title: 'Layout/TopBar',
  component: TopBar,
  tags: ['autodocs'],
  decorators: [
    Story => (
      <SessionProvider session={session}>
        <div className="bg-bg">
          <Story />
        </div>
      </SessionProvider>
    ),
  ],
  args: {
    breadcrumbs: [{ label: 'Ventas', href: '/ventas' }, { label: 'Facturas' }],
    userName: 'Cristian Moyano',
    userRole: 'admin',
  },
}
export default meta
type Story = StoryObj<typeof TopBar>

export const Default: Story = {}

export const WithActions: Story = {
  args: {
    actions: (
      <>
        <Button size="sm" variant="secondary">Filtrar</Button>
        <Button size="sm">Nueva factura</Button>
      </>
    ),
  },
}

export const WithoutChrome: Story = {
  args: {
    hideChrome: true,
  },
}
