import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import type { TenantContext } from '@/lib/tenancy'

vi.mock('@/modules/auth/organization.model', () => ({ default: { findByPk: vi.fn() } }))

const { pathContextMock } = vi.hoisted(() => ({ pathContextMock: vi.fn() }))

vi.mock('./owner-registry', () => ({
  OWNER_RESOLVERS: {
    supplier_invoice: { pathContext: pathContextMock },
    invoice: { pathContext: pathContextMock },
    product: { pathContext: pathContextMock },
    contact: { pathContext: pathContextMock },
    purchase_receipt: { pathContext: pathContextMock },
  },
}))

import Organization from '@/modules/auth/organization.model'
import {
  buildStorageKey,
  sanitizePathSegment,
  sanitizeStorageFilename,
  shortOwnerId,
} from './storage-path.service'

const ctx: TenantContext = {
  orgId: '83bf40ed-4200-4c23-a915-33011b50af50',
  userId: 'user-1',
  defaultBranchId: 'branch-1',
  allowedBranchIds: ['branch-1'],
  salesScopeOwn: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(Organization.findByPk as Mock).mockResolvedValue({ slug: 'acme' })
  pathContextMock.mockResolvedValue({ branchCode: 1, documentRef: 'FP-00042' })
})

describe('sanitizePathSegment', () => {
  it('lowercases and replaces unsafe characters', () => {
    expect(sanitizePathSegment('FC-P 00042')).toBe('fc-p_00042')
    expect(sanitizePathSegment('  Mi Empresa S.A. ')).toBe('mi_empresa_s.a')
  })

  it('returns unknown for empty input', () => {
    expect(sanitizePathSegment('   !!!')).toBe('unknown')
  })
})

describe('sanitizeStorageFilename', () => {
  it('strips path components and sanitizes', () => {
    expect(sanitizeStorageFilename('../Andiko POS.pdf')).toBe('Andiko_POS.pdf')
  })
})

describe('shortOwnerId', () => {
  it('returns first 8 hex chars without dashes', () => {
    expect(shortOwnerId('98f01f7f-b7a9-451e-8b39-b52daf7f0b33')).toBe('98f01f7f')
  })
})

describe('buildStorageKey', () => {
  it('builds a structured path with org slug, branch, module, date and doc ref', async () => {
    const fileId = '98f01f7f-b7a9-451e-8b39-b52daf7f0b33'
    const key = await buildStorageKey({
      orgId: ctx.orgId,
      fileId,
      filename: 'Andiko POS.pdf',
      primaryLink: { owner_type: 'supplier_invoice', owner_id: 'inv-uuid-0001' },
      ctx,
      uploadedAt: new Date('2026-06-28T15:00:00.000Z'),
    })

    expect(key).toBe(
      'acme/suc-001/compras/facturas-proveedor/2026/06/28/fp-00042__98f01f7f__Andiko_POS.pdf',
    )
    expect(key).not.toContain(ctx.orgId)
  })

  it('uses org segment when owner has no branch', async () => {
    pathContextMock.mockResolvedValue({ branchCode: null, documentRef: 'widget-pro' })

    const key = await buildStorageKey({
      orgId: ctx.orgId,
      fileId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      filename: 'photo.png',
      primaryLink: { owner_type: 'product', owner_id: 'prod-1' },
      ctx,
      uploadedAt: new Date('2026-01-02T03:00:00.000Z'),
    })

    expect(key.startsWith('acme/org/catalogo/productos/')).toBe(true)
  })

  it('throws when organization is missing', async () => {
    ;(Organization.findByPk as Mock).mockResolvedValue(null)
    await expect(
      buildStorageKey({
        orgId: 'missing',
        fileId: 'file-1',
        filename: 'a.pdf',
        primaryLink: { owner_type: 'invoice', owner_id: 'inv-1' },
        ctx,
      }),
    ).rejects.toThrow('ORG_NOT_FOUND')
  })
})
