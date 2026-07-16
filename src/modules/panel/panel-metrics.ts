export interface PanelMarginInputs {
  facturacionNeta: number
  cmv: number
  expensas: number
}

export function calcMargenBruto(facturacionNeta: number, cmv: number): number {
  return facturacionNeta - cmv
}

/** Ganancia sobre la venta: (venta − costo) / venta */
export function calcMargenGananciaPct(facturacionNeta: number, cmv: number): number | null {
  if (facturacionNeta <= 0) return null
  const margen = facturacionNeta - cmv
  return roundPct((margen / facturacionNeta) * 100)
}

export function calcRentabilidad(
  facturacionNeta: number,
  cmv: number,
  expensas: number,
): { value: number; pct: number | null } {
  const value = facturacionNeta - cmv - expensas
  const pct = facturacionNeta > 0
    ? roundPct((value / facturacionNeta) * 100)
    : null
  return { value, pct }
}

/** Expensas ÷ margen de ganancia (como fracción). Null si margen ≤ 0. */
export function calcPuntoEquilibrio(expensas: number, margenGananciaPct: number | null): number | null {
  if (margenGananciaPct == null || margenGananciaPct <= 0 || expensas <= 0) return null
  return Math.round((expensas / (margenGananciaPct / 100)) * 100) / 100
}

export function calcCostCoveragePct(coveredRevenue: number, totalRevenue: number): number {
  if (totalRevenue <= 0) return 100
  return roundPct((coveredRevenue / totalRevenue) * 100)
}

function roundPct(value: number): number {
  return Math.round(value * 100) / 100
}
