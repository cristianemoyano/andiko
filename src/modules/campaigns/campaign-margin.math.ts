import Decimal from 'decimal.js'

/**
 * Matemática de rentabilidad de un descuento.
 *
 * Regla de oro (para no perder plata): el **límite** de un descuento es el **costo variable**
 * del producto. El precio con descuento SIEMPRE debe ser mayor a lo que cuesta adquirir/producir
 * el producto; por debajo de ese límite cada venta genera pérdida directa.
 *
 * Núcleo puro (sin DB) — foco de tests.
 */
export interface MarginResult {
  list_price: string
  cost_price: string
  discount_pct: string
  discounted_price: string
  /** Margen de contribución por unidad: precio con descuento − costo. */
  margin_amount: string
  /** Margen sobre el precio con descuento (%). */
  margin_pct: string
  /** true si el precio con descuento ≤ costo → la venta pierde plata. */
  is_loss: boolean
  /** Máximo descuento (%) que mantiene el precio por encima del costo (margen 0 en el límite). */
  max_safe_discount_pct: string
}

export function analyzeMargin(
  listPrice: string | number | null,
  costPrice: string | number | null,
  discountPct: string | number,
): MarginResult {
  const list = new Decimal(listPrice || 0)
  const cost = new Decimal(costPrice || 0)
  const disc = new Decimal(discountPct || 0)

  const discounted = list.mul(new Decimal(100).minus(disc)).div(100)
  const marginAmount = discounted.minus(cost)
  const marginPct = discounted.gt(0) ? marginAmount.div(discounted).mul(100) : new Decimal(0)
  const isLoss = discounted.lte(cost)

  // Precio con descuento = costo ⇒ list·(1 − d/100) = cost ⇒ d = (1 − cost/list)·100
  const maxSafe = list.gt(0)
    ? Decimal.max(new Decimal(0), new Decimal(1).minus(cost.div(list)).mul(100))
    : new Decimal(0)

  return {
    list_price: list.toFixed(2),
    cost_price: cost.toFixed(2),
    discount_pct: disc.toFixed(2),
    discounted_price: discounted.toFixed(2),
    margin_amount: marginAmount.toFixed(2),
    margin_pct: marginPct.toFixed(2),
    is_loss: isLoss,
    max_safe_discount_pct: maxSafe.toFixed(2),
  }
}

export interface MarginSummary {
  products: number
  losing: number
  /** Menor margen % entre los productos afectados. */
  min_margin_pct: string
  /** Descuento máximo (%) que mantiene rentables a TODOS los productos afectados (el más restrictivo). */
  safe_discount_ceiling_pct: string
  /** true si al menos un producto queda en pérdida con el descuento actual. */
  has_losses: boolean
}

export function summarizeMargins(rows: MarginResult[]): MarginSummary {
  if (rows.length === 0) {
    return { products: 0, losing: 0, min_margin_pct: '0.00', safe_discount_ceiling_pct: '0.00', has_losses: false }
  }

  const losing = rows.filter((r) => r.is_loss).length
  const minMargin = rows.reduce((min, r) => Decimal.min(min, r.margin_pct), new Decimal(rows[0].margin_pct))
  // El techo seguro global es el descuento máximo seguro MÁS BAJO entre los productos
  // (el producto con menor colchón manda: por encima de ese %, alguno entra en pérdida).
  const ceiling = rows.reduce(
    (min, r) => Decimal.min(min, r.max_safe_discount_pct),
    new Decimal(rows[0].max_safe_discount_pct),
  )

  return {
    products: rows.length,
    losing,
    min_margin_pct: minMargin.toFixed(2),
    safe_discount_ceiling_pct: ceiling.toFixed(2),
    has_losses: losing > 0,
  }
}
