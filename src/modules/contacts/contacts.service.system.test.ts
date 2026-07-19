import { describe, it, expect, vi, beforeEach } from 'vitest'

const { contactUpdate, contactDestroy } = vi.hoisted(() => ({
  contactUpdate: vi.fn(),
  contactDestroy: vi.fn(),
}))

vi.mock('./contact.model', () => ({
  default: {
    findOne: vi.fn(),
    findAndCountAll: vi.fn(),
    create: vi.fn(),
  },
}))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/db', () => ({ default: { transaction: vi.fn() } }))
vi.mock('@/modules/integrations/woocommerce/woocommerce-customer-link.model', () => ({
  default: { findAll: vi.fn().mockResolvedValue([]) },
}))
vi.mock('@/lib/tenancy', () => ({
  whereOrg: (_ctx: { orgId: string }, extra: Record<string, unknown> = {}) => ({
    org_id: 'org-1',
    ...extra,
  }),
}))

import Contact from './contact.model'
import { updateContact, deleteContact } from './contacts.service'

describe('contacts.service system contact guards', () => {
  const ctx = { orgId: 'org-1', branchId: null, userId: 'u1', role: 'admin' } as never

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(Contact.findOne).mockResolvedValue({
      id: 'cf-1',
      is_system: true,
      update: contactUpdate,
      destroy: contactDestroy,
    } as never)
  })

  it('rejects update of system contact', async () => {
    await expect(
      updateContact('cf-1', { legal_name: 'Hack' }, ctx, 'actor-1'),
    ).rejects.toThrow('SYSTEM_CONTACT_NOT_EDITABLE')
    expect(contactUpdate).not.toHaveBeenCalled()
  })

  it('rejects deactivate of system contact', async () => {
    await expect(
      updateContact('cf-1', { is_active: false }, ctx, 'actor-1'),
    ).rejects.toThrow('SYSTEM_CONTACT_NOT_DEACTIVATABLE')
  })

  it('rejects delete of system contact', async () => {
    await expect(deleteContact('cf-1', ctx, 'actor-1')).rejects.toThrow('SYSTEM_CONTACT_NOT_DELETABLE')
    expect(contactDestroy).not.toHaveBeenCalled()
  })
})
