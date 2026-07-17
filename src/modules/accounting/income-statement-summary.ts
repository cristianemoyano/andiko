import Decimal from 'decimal.js'

export type IncomeStatementInputRow = {
  account_id: string
  code: string
  name: string
  type: string
  saldo_debit: string
  saldo_credit: string
}

export type IncomeStatementLine = {
  account_id: string
  code: string
  name: string
  /** Signado: negativo cuando la cuenta juega en contra de su sección (ej. contra-ingresos). */
  amount: string
}

export type IncomeStatementSectionKey =
  | 'ingresos'
  | 'costo_de_ventas'
  | 'gastos_operativos'
  | 'gastos_financieros'
  | 'otros_egresos'

export type IncomeStatementSection = {
  key: IncomeStatementSectionKey
  label: string
  rows: IncomeStatementLine[]
  total: string
}

export type IncomeStatementSummary = {
  sections: IncomeStatementSection[]
  total_ingresos: string
  total_costo: string
  resultado_bruto: string
  total_gastos: string
  resultado_neto: string
}

const SECTION_LABELS: Record<IncomeStatementSectionKey, string> = {
  ingresos: 'Ingresos',
  costo_de_ventas: 'Costo de ventas',
  gastos_operativos: 'Gastos operativos',
  gastos_financieros: 'Gastos financieros',
  otros_egresos: 'Otros egresos',
}

function expenseSectionFor(code: string): IncomeStatementSectionKey {
  if (code.startsWith('5.1')) return 'costo_de_ventas'
  if (code.startsWith('5.2')) return 'gastos_operativos'
  if (code.startsWith('5.3')) return 'gastos_financieros'
  return 'otros_egresos'
}

/**
 * Estado de resultados a partir de filas del balance de sumas y saldos
 * (solo cuentas income/expense; el resto se ignora). Agrupa por prefijo de
 * código del plan PyME por defecto; códigos custom caen en "Otros egresos"
 * en lugar de perderse.
 */
export function summarizeIncomeStatement(rows: IncomeStatementInputRow[]): IncomeStatementSummary {
  const sections: Record<IncomeStatementSectionKey, IncomeStatementLine[]> = {
    ingresos: [],
    costo_de_ventas: [],
    gastos_operativos: [],
    gastos_financieros: [],
    otros_egresos: [],
  }
  const totals: Record<IncomeStatementSectionKey, Decimal> = {
    ingresos: new Decimal(0),
    costo_de_ventas: new Decimal(0),
    gastos_operativos: new Decimal(0),
    gastos_financieros: new Decimal(0),
    otros_egresos: new Decimal(0),
  }

  for (const row of rows) {
    if (row.type !== 'income' && row.type !== 'expense') continue

    const net = new Decimal(row.saldo_debit).minus(row.saldo_credit)
    // Ingresos con saldo acreedor y egresos con saldo deudor son positivos en su sección.
    const key: IncomeStatementSectionKey = row.type === 'income' ? 'ingresos' : expenseSectionFor(row.code)
    const amount = row.type === 'income' ? net.neg() : net

    if (amount.isZero()) continue
    sections[key].push({
      account_id: row.account_id,
      code: row.code,
      name: row.name,
      amount: amount.toFixed(2),
    })
    totals[key] = totals[key].plus(amount)
  }

  const totalIngresos = totals.ingresos
  const totalCosto = totals.costo_de_ventas
  const resultadoBruto = totalIngresos.minus(totalCosto)
  const totalGastos = totals.gastos_operativos.plus(totals.gastos_financieros).plus(totals.otros_egresos)
  const resultadoNeto = resultadoBruto.minus(totalGastos)

  return {
    sections: (Object.keys(sections) as IncomeStatementSectionKey[]).map(key => ({
      key,
      label: SECTION_LABELS[key],
      rows: sections[key].sort((a, b) => a.code.localeCompare(b.code)),
      total: totals[key].toFixed(2),
    })),
    total_ingresos: totalIngresos.toFixed(2),
    total_costo: totalCosto.toFixed(2),
    resultado_bruto: resultadoBruto.toFixed(2),
    total_gastos: totalGastos.toFixed(2),
    resultado_neto: resultadoNeto.toFixed(2),
  }
}
