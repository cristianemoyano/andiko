export type PanelWidgetId =
  | 'performance'
  | 'analytics_revenue'
  | 'analytics_orders'
  | 'analytics_products'
  | 'kpi_cards'
  | 'top_debts'
  | 'counts'
  | 'stock_alerts'
  | 'cash_flow'
  | 'gastos'
  | 'recent_invoices'
  | 'activity'

export const PANEL_WIDGETS: Record<PanelWidgetId, { label: string }> = {
  performance: { label: 'Rendimiento' },
  analytics_revenue: { label: 'Ingresos' },
  analytics_orders: { label: 'Pedidos' },
  analytics_products: { label: 'Mejores productos' },
  kpi_cards: { label: 'Indicadores principales' },
  top_debts: { label: 'Cobranzas y deudas (top 5)' },
  counts: { label: 'Resumen de registros' },
  stock_alerts: { label: 'Alertas de stock' },
  cash_flow: { label: 'Flujo de caja' },
  gastos: { label: 'Gastos por proveedor' },
  recent_invoices: { label: 'Facturas recientes' },
  activity: { label: 'Actividad reciente' },
}

export const ALL_PANEL_WIDGET_IDS = Object.keys(PANEL_WIDGETS) as PanelWidgetId[]

/** Default dashboard widget order (matches original panel layout). */
export const DEFAULT_PANEL_WIDGET_ORDER: PanelWidgetId[] = [
  'performance',
  'analytics_revenue',
  'analytics_orders',
  'analytics_products',
  'kpi_cards',
  'top_debts',
  'counts',
  'stock_alerts',
  'cash_flow',
  'gastos',
  'recent_invoices',
  'activity',
]

export const PANEL_WIDGETS_STORAGE_KEY = 'andiko:panel:hidden-widgets'
export const PANEL_WIDGET_ORDER_STORAGE_KEY = 'andiko:panel:widget-order'

export function normalizePanelWidgetOrder(order: unknown): PanelWidgetId[] {
  if (!Array.isArray(order)) return [...DEFAULT_PANEL_WIDGET_ORDER]

  const seen = new Set<PanelWidgetId>()
  const result: PanelWidgetId[] = []

  for (const id of order) {
    if (isPanelWidgetId(id) && !seen.has(id)) {
      seen.add(id)
      result.push(id)
    }
  }

  for (const id of DEFAULT_PANEL_WIDGET_ORDER) {
    if (!seen.has(id)) result.push(id)
  }

  return result
}

export function isPanelWidgetId(value: unknown): value is PanelWidgetId {
  return typeof value === 'string' && value in PANEL_WIDGETS
}

export function parseHiddenPanelWidgets(raw: string | null): PanelWidgetId[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isPanelWidgetId)
  } catch {
    return []
  }
}
