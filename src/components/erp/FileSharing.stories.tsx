'use client'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { FileSharing } from './FileSharing'
import { Button } from '@/components/primitives/Button'
import type { FileShare } from '@/lib/storage-client'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const SHARES: FileShare[] = [
  { id: '1', principal_type: 'user', principal_id: 'a1b2c3d4-0000-0000-0000-000000000001', permission: 'read', expires_at: null, created_at: '2026-06-01T10:00:00Z' },
  { id: '2', principal_type: 'org_role', principal_id: 'role-contador', permission: 'write', expires_at: null, created_at: '2026-06-02T10:00:00Z' },
  { id: '3', principal_type: 'branch', principal_id: 'branch-centro', permission: 'read', expires_at: '2026-12-31T00:00:00Z', created_at: '2026-06-03T10:00:00Z' },
]

const MOCK_PRINCIPALS = {
  users: [
    { id: 'a1b2c3d4-0000-0000-0000-000000000001', label: 'Ana García (ana@empresa.com)' },
    { id: 'a1b2c3d4-0000-0000-0000-000000000002', label: 'Bruno López (bruno@empresa.com)' },
  ],
  org_roles: [
    { id: 'role-contador', label: 'Contador' },
    { id: 'role-compras', label: 'Compras' },
  ],
  branches: [
    { id: 'branch-centro', label: 'Centro (001)' },
    { id: 'branch-norte', label: 'Norte (002)' },
  ],
}

function Harness({ initial, canManage }: { initial: FileShare[]; canManage: boolean }) {
  const [open, setOpen] = useState(true)
  const [shares, setShares] = useState<FileShare[]>(initial)

  return (
    <>
      <Button onClick={() => setOpen(true)}>Compartir</Button>
      <FileSharing
        open={open}
        onOpenChange={setOpen}
        fileId="file-1"
        fileName="contrato-alquiler.pdf"
        canManage={canManage}
        listShares={async () => { await sleep(300); return shares }}
        addShare={async (_id, input) => {
          await sleep(400)
          const created: FileShare = { id: crypto.randomUUID(), ...input, expires_at: input.expires_at ?? null, created_at: new Date().toISOString() }
          setShares((s) => [...s, created])
          return created
        }}
        revokeShare={async (_id, shareId) => { await sleep(300); setShares((s) => s.filter((x) => x.id !== shareId)) }}
        fetchPrincipals={async () => { await sleep(200); return MOCK_PRINCIPALS }}
      />
    </>
  )
}

const meta: Meta<typeof FileSharing> = {
  title: 'ERP/FileSharing',
  component: FileSharing,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: 'Dialog to manage a file\'s explicit ReBAC shares. Stories inject fake list/add/revoke so they work offline.' } },
  },
}
export default meta
type Story = StoryObj<typeof FileSharing>

export const WithShares: Story = {
  render: () => <Harness initial={SHARES} canManage />,
}

export const Empty: Story = {
  render: () => <Harness initial={[]} canManage />,
}

export const ReadOnly: Story = {
  render: () => <Harness initial={SHARES} canManage={false} />,
}
