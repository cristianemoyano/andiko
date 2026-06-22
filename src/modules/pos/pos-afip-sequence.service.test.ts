import { describe, expect, it } from 'vitest'
import { UniqueConstraintError } from 'sequelize'
import { isAfipCbteUniqueViolation } from '@/modules/pos/pos-afip-sequence.utils'

describe('isAfipCbteUniqueViolation', () => {
  it('detects uq_invoices_afip_cbte constraint', () => {
    const err = new UniqueConstraintError({
      message: 'Validation error',
      errors: [],
      fields: { org_id: 'x', punto_venta: 2, comprobante_tipo: 1, cbte_numero: 1 },
      parent: { constraint: 'uq_invoices_afip_cbte' } as never,
    })
    expect(isAfipCbteUniqueViolation(err)).toBe(true)
  })

  it('returns false for unrelated validation errors', () => {
    const err = new UniqueConstraintError({
      message: 'Validation error',
      errors: [],
      fields: { invoice_number: 'FAC-01-0001' },
      parent: { constraint: 'invoices_invoice_number_org_id_key' } as never,
    })
    expect(isAfipCbteUniqueViolation(err)).toBe(false)
  })
})
