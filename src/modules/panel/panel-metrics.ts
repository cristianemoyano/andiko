export interface PanelMarginInputs {
  /** Net sales with a cost snapshot (denominator for margin %). */
  coveredRevenue: number
  cmv: number
  expensas: number
}

/** Gross profit on lines that have a cost snapshot. */
export function calcMargenBruto(coveredRevenue: number, cmv: number): number {
  return coveredRevenue - cmv
}

/**
 * Ganancia sobre la venta: (venta − costo) / venta.
 * `coveredRevenue` must be net sales that have unit_cost — never include lines without cost.
 */
export function calcMargenGananciaPct(coveredRevenue: number, cmv: number): number | null {
  if (coveredRevenue <= 0) return null
  const margen = coveredRevenue - cmv
  return roundPct((margen / coveredRevenue) * 100)
}

/**
 * Operating result after CMV and net expenses, over covered (costed) sales.
 * Callers must pass expense amounts net of IVA.
 */
export function calcRentabilidad(
  coveredRevenue: number,
  cmv: number,
  expensasNetas: number,
): { value: number; pct: number | null } {
  const value = coveredRevenue - cmv - expensasNetas
  const pct = coveredRevenue > 0
    ? roundPct((value / coveredRevenue) * 100)
    : null
  return { value, pct }
}

/** Expensas netas ÷ margen de ganancia (fracción). Null si margen ≤ 0. */
export function calcPuntoEquilibrio(expensasNetas: number, margenGananciaPct: number | null): number | null {
  if (margenGananciaPct == null || margenGananciaPct <= 0 || expensasNetas <= 0) return null
  return Math.round((expensasNetas / (margenGananciaPct / 100)) * 100) / 100
}

export function calcCostCoveragePct(coveredRevenue: number, totalRevenue: number): number {
  if (totalRevenue <= 0) return 100
  return roundPct((coveredRevenue / totalRevenue) * 100)
}

function roundPct(value: number): number {
  return Math.round(value * 100) / 100
}
