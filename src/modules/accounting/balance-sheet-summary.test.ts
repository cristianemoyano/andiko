import { describe, expect, it } from 'vitest'
import { summarizeBalanceSheet } from './balance-sheet-summary'

describe('summarizeBalanceSheet', () => {
  it('sums activos, pasivos y patrimonio neto por tipo de cuenta', () => {
    const summary = summarizeBalanceSheet([
      { type: 'asset', saldo_debit: '250000.00', saldo_credit: '0.00' },
      { type: 'liability', saldo_debit: '0.00', saldo_credit: '100000.00' },
      { type: 'equity', saldo_debit: '0.00', saldo_credit: '150000.00' },
    ])

    expect(summary).toEqual({
      total_assets: '250000.00',
      total_liabilities: '100000.00',
      net_equity: '150000.00',
    })
  })
})
