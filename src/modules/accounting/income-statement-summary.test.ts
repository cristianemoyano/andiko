import { describe, it, expect } from 'vitest'
import { summarizeIncomeStatement, type IncomeStatementInputRow } from './income-statement-summary'

function row(overrides: Partial<IncomeStatementInputRow>): IncomeStatementInputRow {
  return {
    account_id: overrides.account_id ?? overrides.code ?? 'acc-1',
    code: '4.1.01',
    name: 'Ventas',
    type: 'income',
    saldo_debit: '0.00',
    saldo_credit: '0.00',
    ...overrides,
  }
}

describe('summarizeIncomeStatement', () => {
  it('computes ganancia: ingresos menos costo y gastos', () => {
    const result = summarizeIncomeStatement([
      row({ code: '4.1.01', name: 'Ventas', type: 'income', saldo_credit: '1000.00' }),
      row({ code: '5.1.01', name: 'CMV', type: 'expense', saldo_debit: '400.00' }),
      row({ code: '5.2.05', name: 'Alquileres', type: 'expense', saldo_debit: '100.00' }),
      row({ code: '5.3.01', name: 'Intereses pagados', type: 'expense', saldo_debit: '50.00' }),
    ])

    expect(result.total_ingresos).toBe('1000.00')
    expect(result.total_costo).toBe('400.00')
    expect(result.resultado_bruto).toBe('600.00')
    expect(result.total_gastos).toBe('150.00')
    expect(result.resultado_neto).toBe('450.00')
  })

  it('computes pérdida como resultado neto negativo', () => {
    const result = summarizeIncomeStatement([
      row({ code: '4.1.01', type: 'income', saldo_credit: '100.00' }),
      row({ code: '5.2.01', type: 'expense', saldo_debit: '300.00' }),
    ])
    expect(result.resultado_neto).toBe('-200.00')
  })

  it('groups expense accounts by code prefix into secciones', () => {
    const result = summarizeIncomeStatement([
      row({ code: '5.1.01', type: 'expense', saldo_debit: '10.00' }),
      row({ code: '5.2.03', type: 'expense', saldo_debit: '20.00' }),
      row({ code: '5.3.02', type: 'expense', saldo_debit: '30.00' }),
    ])
    const byKey = Object.fromEntries(result.sections.map(s => [s.key, s]))
    expect(byKey.costo_de_ventas.total).toBe('10.00')
    expect(byKey.gastos_operativos.total).toBe('20.00')
    expect(byKey.gastos_financieros.total).toBe('30.00')
  })

  it('sends custom expense codes to otros_egresos instead of dropping them', () => {
    const result = summarizeIncomeStatement([
      row({ code: '9.9.99', name: 'Cuenta custom', type: 'expense', saldo_debit: '77.00' }),
    ])
    const otros = result.sections.find(s => s.key === 'otros_egresos')
    expect(otros?.rows).toHaveLength(1)
    expect(otros?.total).toBe('77.00')
    expect(result.total_gastos).toBe('77.00')
  })

  it('ignores non-result account types and zero-balance rows', () => {
    const result = summarizeIncomeStatement([
      row({ code: '1.1.01', name: 'Caja', type: 'asset', saldo_debit: '500.00' }),
      row({ code: '4.1.01', type: 'income', saldo_credit: '0.00' }),
    ])
    expect(result.sections.every(s => s.rows.length === 0)).toBe(true)
    expect(result.resultado_neto).toBe('0.00')
  })

  it('shows contra-ingresos (income con saldo deudor) como negativos en su sección', () => {
    const result = summarizeIncomeStatement([
      row({ code: '4.1.01', name: 'Ventas', type: 'income', saldo_credit: '1000.00' }),
      row({ code: '4.1.03', name: 'Devoluciones sobre ventas', type: 'income', saldo_debit: '100.00' }),
    ])
    const ingresos = result.sections.find(s => s.key === 'ingresos')
    expect(ingresos?.rows.find(r => r.code === '4.1.03')?.amount).toBe('-100.00')
    expect(result.total_ingresos).toBe('900.00')
  })
})
