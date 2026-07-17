import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { buildClosingLines, buildReversalLines, type ClosingBalanceRow } from './period-close.utils'

const RESULT_ACCOUNT = 'acc-resultado'

function row(overrides: Partial<ClosingBalanceRow>): ClosingBalanceRow {
  return {
    account_id: overrides.account_id ?? 'acc-x',
    code: '4.1.01',
    name: 'Ventas',
    type: 'income',
    saldo_debit: '0.00',
    saldo_credit: '0.00',
    ...overrides,
  }
}

function assertBalanced(lines: { debit: string; credit: string }[]) {
  const debit = lines.reduce((s, l) => s.plus(l.debit), new Decimal(0))
  const credit = lines.reduce((s, l) => s.plus(l.credit), new Decimal(0))
  expect(debit.toFixed(2)).toBe(credit.toFixed(2))
}

describe('buildClosingLines', () => {
  it('closes a ganancia crediting resultado del ejercicio', () => {
    const lines = buildClosingLines(
      [
        row({ account_id: 'ventas', code: '4.1.01', type: 'income', saldo_credit: '1000.00' }),
        row({ account_id: 'cmv', code: '5.1.01', type: 'expense', saldo_debit: '400.00' }),
      ],
      RESULT_ACCOUNT,
    )

    assertBalanced(lines)
    expect(lines.find(l => l.account_id === 'ventas')).toMatchObject({ debit: '1000.00', credit: '0.00' })
    expect(lines.find(l => l.account_id === 'cmv')).toMatchObject({ debit: '0.00', credit: '400.00' })
    expect(lines.find(l => l.account_id === RESULT_ACCOUNT)).toMatchObject({ debit: '0.00', credit: '600.00' })
  })

  it('closes a pérdida debiting resultado del ejercicio', () => {
    const lines = buildClosingLines(
      [
        row({ account_id: 'ventas', code: '4.1.01', type: 'income', saldo_credit: '100.00' }),
        row({ account_id: 'gastos', code: '5.2.01', type: 'expense', saldo_debit: '300.00' }),
      ],
      RESULT_ACCOUNT,
    )

    assertBalanced(lines)
    expect(lines.find(l => l.account_id === RESULT_ACCOUNT)).toMatchObject({ debit: '200.00', credit: '0.00' })
  })

  it('omits the result line when ingresos equal egresos', () => {
    const lines = buildClosingLines(
      [
        row({ account_id: 'ventas', code: '4.1.01', type: 'income', saldo_credit: '500.00' }),
        row({ account_id: 'gastos', code: '5.2.01', type: 'expense', saldo_debit: '500.00' }),
      ],
      RESULT_ACCOUNT,
    )
    assertBalanced(lines)
    expect(lines.find(l => l.account_id === RESULT_ACCOUNT)).toBeUndefined()
  })

  it('skips zero balances and non-result accounts, returning [] when nothing to close', () => {
    expect(buildClosingLines([], RESULT_ACCOUNT)).toEqual([])
    expect(
      buildClosingLines(
        [
          row({ account_id: 'caja', code: '1.1.01', type: 'asset', saldo_debit: '999.00' }),
          row({ account_id: 'ventas', code: '4.1.01', type: 'income', saldo_credit: '0.00' }),
        ],
        RESULT_ACCOUNT,
      ),
    ).toEqual([])
  })

  it('handles contra accounts (income con saldo deudor)', () => {
    const lines = buildClosingLines(
      [
        row({ account_id: 'ventas', code: '4.1.01', type: 'income', saldo_credit: '1000.00' }),
        row({ account_id: 'devoluciones', code: '4.1.03', type: 'income', saldo_debit: '100.00' }),
      ],
      RESULT_ACCOUNT,
    )
    assertBalanced(lines)
    expect(lines.find(l => l.account_id === 'devoluciones')).toMatchObject({ debit: '0.00', credit: '100.00' })
    expect(lines.find(l => l.account_id === RESULT_ACCOUNT)).toMatchObject({ debit: '0.00', credit: '900.00' })
  })
})

describe('buildReversalLines', () => {
  it('swaps debit and credit of every line', () => {
    const reversed = buildReversalLines([
      { account_id: 'ventas', debit: '1000.00', credit: '0.00', description: 'Cierre 4.1.01 Ventas' },
      { account_id: RESULT_ACCOUNT, debit: '0.00', credit: '600.00', description: null },
    ])
    expect(reversed[0]).toMatchObject({ account_id: 'ventas', debit: '0.00', credit: '1000.00' })
    expect(reversed[1]).toMatchObject({ account_id: RESULT_ACCOUNT, debit: '600.00', credit: '0.00' })
    assertBalanced([
      { debit: '1000.00', credit: '0.00' },
      ...reversed.map(l => ({ debit: l.debit, credit: l.credit })),
      { debit: '0.00', credit: '600.00' },
    ])
  })
})
