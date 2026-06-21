'use client'

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useEffect, useState } from 'react'
import { SessionProvider } from 'next-auth/react'
import { BranchSelectField } from './BranchSelectField'

function BranchesFetchMock({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const orig = globalThis.fetch.bind(globalThis)
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (u.includes('/api/v1/branches')) {
        return new Response(
          JSON.stringify({
            data: [
              { id: 'b1', org_id: 'o1', name: 'Casa Central', branch_code: 1, address: null, is_active: true },
              { id: 'b2', org_id: 'o1', name: 'Sucursal Norte', branch_code: 2, address: null, is_active: true },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return orig(input, init)
    }
    return () => {
      globalThis.fetch = orig
    }
  }, [])
  return <>{children}</>
}

const meta: Meta<typeof BranchSelectField> = {
  title: 'ERP/BranchSelectField',
  component: BranchSelectField,
  tags: ['autodocs'],
  decorators: [
    Story => (
      <SessionProvider
        session={{
          user: {
            id: 'u1',
            email: 'op@test.com',
            name: 'Vendedor',
            role: 'operator',
            orgId: 'o1',
            branchId: 'b1',
            orgRoleId: null,
            actingOrgId: null,
            realRole: 'operator',
            realOrgId: 'o1',
            realBranchId: 'b1',
            impersonation: null,
          },
          expires: new Date(Date.now() + 86400000).toISOString(),
        }}
      >
        <BranchesFetchMock>
          <div className="w-96 p-4">
            <Story />
          </div>
        </BranchesFetchMock>
      </SessionProvider>
    ),
  ],
}
export default meta
type Story = StoryObj<typeof BranchSelectField>

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState<string | null>(null)
    return <BranchSelectField value={value} onChange={setValue} />
  },
}

export const Disabled: Story = {
  render: () => (
    <BranchSelectField value="b1" onChange={() => {}} disabled error={undefined} />
  ),
}
