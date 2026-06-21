import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('./afip-emission.model', () => ({ default: { findOne: vi.fn(), findAll: vi.fn(), findAndCountAll: vi.fn() } }))
vi.mock('./afip-emission.service', () => ({
  requestCAEForInvoice: vi.fn(),
  requestCAEForCreditNote: vi.fn(),
  requestCAEForDebitNote: vi.fn(),
}))

import AfipEmission from './afip-emission.model'
import { requestCAEForInvoice, requestCAEForDebitNote } from './afip-emission.service'
import { retryEmission, syncPendingEmissions } from './afip-contingency.service'

const ctx = { orgId: 'org-1', userId: 'u-1', defaultBranchId: null, allowedBranchIds: [] }

beforeEach(() => vi.clearAllMocks())

describe('retryEmission', () => {
  it('dispatches an invoice emission to the invoice service', async () => {
    ;(AfipEmission.findOne as Mock).mockResolvedValue({ status: 'error', document_type: 'invoice', document_id: 'inv-9' })
    ;(requestCAEForInvoice as Mock).mockResolvedValue({ afip_status: 'authorized' })

    await retryEmission('em-1', ctx)

    expect(requestCAEForInvoice).toHaveBeenCalledWith('inv-9', ctx, {})
  })

  it('dispatches a debit note emission to the debit note service', async () => {
    ;(AfipEmission.findOne as Mock).mockResolvedValue({ status: 'pending', document_type: 'debit_note', document_id: 'nd-2' })
    ;(requestCAEForDebitNote as Mock).mockResolvedValue({ afip_status: 'authorized' })

    await retryEmission('em-2', ctx)

    expect(requestCAEForDebitNote).toHaveBeenCalledWith('nd-2', ctx, {})
  })

  it('throws EMISSION_NOT_FOUND when missing', async () => {
    ;(AfipEmission.findOne as Mock).mockResolvedValue(null)
    await expect(retryEmission('x', ctx)).rejects.toThrow('EMISSION_NOT_FOUND')
  })

  it('throws when the emission is already authorized', async () => {
    ;(AfipEmission.findOne as Mock).mockResolvedValue({ status: 'authorized', document_type: 'invoice', document_id: 'i' })
    await expect(retryEmission('x', ctx)).rejects.toThrow('EMISSION_ALREADY_AUTHORIZED')
  })
})

describe('syncPendingEmissions', () => {
  it('retries each pending emission and reports its resulting status', async () => {
    ;(AfipEmission.findAll as Mock).mockResolvedValue([
      { document_type: 'invoice', document_id: 'inv-1' },
      { document_type: 'invoice', document_id: 'inv-2' },
    ])
    ;(requestCAEForInvoice as Mock)
      .mockResolvedValueOnce({ afip_status: 'authorized' })
      .mockRejectedValueOnce(new Error('AFIP_PUNTO_VENTA_REQUIRED'))

    const results = await syncPendingEmissions(ctx)

    expect(results).toEqual([
      { documentId: 'inv-1', status: 'authorized' },
      { documentId: 'inv-2', status: 'error:AFIP_PUNTO_VENTA_REQUIRED' },
    ])
  })
})
