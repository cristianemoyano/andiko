'use client'

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PanelAnalytics } from './PanelAnalytics'
import { PanelWidgetProvider } from './PanelWidgetProvider'
import type { PanelAnalytics as PanelAnalyticsData } from '@/modules/panel/panel.types'

const SAMPLE_ANALYTICS: PanelAnalyticsData = {
  compare_period_label: 'Comparado con 1 may 2026 – 31 may 2026',
  revenue: {
    total_sales: {
      value: 17_427_753.66,
      pct_change: 29,
      spark: [1.2, 1.5, 1.1, 1.8, 2.1, 1.9, 2.4].map(v => v * 1_000_000),
    },
    net_sales: {
      value: 14_402_276.58,
      pct_change: 29,
      spark: [1.0, 1.2, 0.9, 1.5, 1.7, 1.6, 2.0].map(v => v * 1_000_000),
    },
  },
  orders: {
    total_orders: { value: 151, pct_change: 41, spark: [12, 18, 15, 22, 28, 20, 24] },
    avg_order_value: { value: 115_415.59, pct_change: -9, spark: [120, 115, 118, 110, 105, 112, 108].map(v => v * 1000) },
  },
  products: {
    items_sold: { value: 7600, pct_change: 28, spark: [800, 950, 1100, 1200, 1050, 1300, 1400] },
    top: [
      { id: '1', name: 'Cortinas Lluvia Metalizadas', image_url: null, net_sales: 323_025, quantity_sold: 295 },
      { id: '2', name: 'Banderin 12 Banderitas', image_url: null, net_sales: 549_450, quantity_sold: 225 },
      { id: '3', name: 'Collar Hawaiano Argentina xU.', image_url: null, net_sales: 134_640, quantity_sold: 187 },
      { id: '4', name: 'Viruta Natural 40g', image_url: null, net_sales: 100_843.05, quantity_sold: 159 },
      { id: '5', name: 'Porras de Tela Vegetal Celeste y Blanca xU.', image_url: null, net_sales: 61_740, quantity_sold: 147 },
    ],
  },
}

const meta: Meta<typeof PanelAnalytics> = {
  title: 'ERP/PanelAnalytics',
  component: PanelAnalytics,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    viewport: { defaultViewport: 'mobile1' },
  },
  decorators: [
    Story => (
      <PanelWidgetProvider>
        <Story />
      </PanelWidgetProvider>
    ),
  ],
}
export default meta
type Story = StoryObj<typeof PanelAnalytics>

export const Default: Story = {
  args: {
    periodLabel: 'Esta semana — 15 jun – 21 jun 2026',
    comparePeriodLabel: SAMPLE_ANALYTICS.compare_period_label,
    analytics: SAMPLE_ANALYTICS,
    lastUpdated: new Date('2026-06-21T02:15:00'),
  },
}

export const Loading: Story = {
  args: {
    periodLabel: 'Este mes — Junio 2026',
    comparePeriodLabel: 'Comparado con 1 may 2026 – 31 may 2026',
    analytics: null,
    loading: true,
  },
}

export const Empty: Story = {
  args: {
    periodLabel: 'Última semana',
    comparePeriodLabel: 'Comparado con período anterior',
    analytics: {
      ...SAMPLE_ANALYTICS,
      products: { items_sold: { value: 0, pct_change: 0, spark: [] }, top: [] },
    },
  },
}
