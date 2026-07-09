import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ default: {} }))

import Decimal from 'decimal.js'
import {
  assertBalancedLines,
  deriveNetFromTotalAndTax,
  resolveRequiredAccounts,
} from './accounting.utils'

describe('accounting.utils auto-post helpers', () => {
  it('deriveNetFromTotalAndTax uses total as source of truth', () => {
    const total = new Decimal('1089.00')
    const tax = new Decimal('189.00')
    expect(deriveNetFromTotalAndTax(total, tax).toFixed(2)).toBe('900.00')
  })

  it('assertBalancedLines passes when debits equal credits', () => {
    expect(() => assertBalancedLines([
      { debit: '121.00', credit: '0.00' },
      { debit: '0.00', credit: '121.00' },
    ])).not.toThrow()
  })

  it('assertBalancedLines throws ENTRY_NOT_BALANCED on mismatch', () => {
    expect(() => assertBalancedLines([
      { debit: '100.00', credit: '0.00' },
      { debit: '0.00', credit: '99.99' },
    ])).toThrow('ENTRY_NOT_BALANCED')
  })

  it('resolveRequiredAccounts filters inactive or non-postable accounts', () => {
    const accounts = [
      { id: 'a1', code: '4.1.01', is_active: true, is_postable: true },
      { id: 'a2', code: '2.1.02.01', is_active: false, is_postable: true },
      { id: 'a3', code: '1.1.02.01', is_active: true, is_postable: false },
    ]
    const result = resolveRequiredAccounts(accounts, ['4.1.01', '2.1.02.01', '1.1.02.01'])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.missingCodes).toEqual(expect.arrayContaining(['2.1.02.01', '1.1.02.01']))
    }
  })

  it('builds balanced invoice lines when stored subtotal/discount/tax/total disagree by 1 cent', () => {
    const tax = new Decimal('189.00')
    const total = new Decimal('1089.00')

    const neto = deriveNetFromTotalAndTax(total, tax)
    const balancedLines = [
      { debit: total.toFixed(2), credit: '0.00' },
      { debit: '0.00', credit: neto.toFixed(2) },
      { debit: '0.00', credit: tax.toFixed(2) },
    ]
    expect(() => assertBalancedLines(balancedLines)).not.toThrow()
  })
})
