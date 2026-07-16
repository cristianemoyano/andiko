import Decimal from 'decimal.js'
import type { AutoPostLine } from './accounting-auto-post.utils'

export type ClosingBalanceRow = {
  account_id: string
  code: string
  name: string
  type: string
  saldo_debit: string
  saldo_credit: string
}

/**
 * Líneas del asiento de cierre: cancela el saldo de cada cuenta de resultado
 * contra la cuenta de resultado del ejercicio. Devuelve [] si no hay nada que
 * cerrar; siempre balanceado cuando no está vacío.
 */
export function buildClosingLines(
  rows: ClosingBalanceRow[],
  resultAccountId: string,
): AutoPostLine[] {
  const lines: AutoPostLine[] = []
  let resultNet = new Decimal(0) // positivo = ganancia (haber a 3.2.02)

  for (const row of rows) {
    if (row.type !== 'income' && row.type !== 'expense') continue
    const net = new Decimal(row.saldo_debit).minus(row.saldo_credit)
    if (net.isZero()) continue

    if (net.gt(0)) {
      // Saldo deudor → se cancela por el haber
      lines.push({
        account_id: row.account_id,
        debit: '0.00',
        credit: net.toFixed(2),
        description: `Cierre ${row.code} ${row.name}`,
      })
      resultNet = resultNet.minus(net)
    } else {
      // Saldo acreedor → se cancela por el debe
      lines.push({
        account_id: row.account_id,
        debit: net.abs().toFixed(2),
        credit: '0.00',
        description: `Cierre ${row.code} ${row.name}`,
      })
      resultNet = resultNet.plus(net.abs())
    }
  }

  if (lines.length === 0) return []

  if (!resultNet.isZero()) {
    lines.push({
      account_id: resultAccountId,
      debit: resultNet.lt(0) ? resultNet.abs().toFixed(2) : '0.00',
      credit: resultNet.gt(0) ? resultNet.toFixed(2) : '0.00',
      description: resultNet.gte(0) ? 'Resultado del ejercicio (ganancia)' : 'Resultado del ejercicio (pérdida)',
    })
  }

  return lines
}

/** Invierte debe/haber de las líneas de un asiento (para la reversión del cierre). */
export function buildReversalLines(
  lines: { account_id: string; debit: string; credit: string; description: string | null }[],
): AutoPostLine[] {
  return lines.map(line => ({
    account_id: line.account_id,
    debit: line.credit,
    credit: line.debit,
    description: line.description ? `Reversión: ${line.description}` : 'Reversión de cierre',
  }))
}
