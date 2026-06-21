export interface PanelMetricWithTrend {
  value: number
  pct_change: number
  spark: number[]
}

export interface PanelTopProduct {
  id: string
  name: string
  image_url: string | null
  net_sales: number
  quantity_sold: number
}

export interface PanelAnalytics {
  compare_period_label: string
  revenue: {
    total_sales: PanelMetricWithTrend
    net_sales: PanelMetricWithTrend
  }
  orders: {
    total_orders: PanelMetricWithTrend
    avg_order_value: PanelMetricWithTrend
  }
  products: {
    items_sold: PanelMetricWithTrend
    top: PanelTopProduct[]
  }
}
