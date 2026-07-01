import Decimal from 'decimal.js'

export type BalanceSheetLine = {
  type: string
  saldo_debit: string
  saldo_credit: string
}

export type BalanceSheetSummary = {
  total_assets: string
  total_liabilities: string
  net_equity: string
}

function netByType(rows: BalanceSheetLine[], type: string, normalSide: 'debit' | 'credit'): Decimal {
  const typed = rows.filter((row) => row.type === type)
  const debit = typed.reduce((sum, row) => sum.plus(row.saldo_debit), new Decimal(0))
  const credit = typed.reduce((sum, row) => sum.plus(row.saldo_credit), new Decimal(0))
  const net = debit.minus(credit)
  return normalSide === 'debit'
    ? (net.gt(0) ? net : new Decimal(0))
    : (net.lt(0) ? net.abs() : new Decimal(0))
}

/** Activos, pasivos y patrimonio neto a partir de filas del balance de sumas y saldos. */
export function summarizeBalanceSheet(rows: BalanceSheetLine[]): BalanceSheetSummary {
  const totalAssets = netByType(rows, 'asset', 'debit')
  const totalLiabilities = netByType(rows, 'liability', 'credit')
  const totalEquity = netByType(rows, 'equity', 'credit')

  return {
    total_assets: totalAssets.toFixed(2),
    total_liabilities: totalLiabilities.toFixed(2),
    net_equity: totalEquity.toFixed(2),
  }
}
