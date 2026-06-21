'use client'

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PerformanceCard } from './PerformanceCard'

const SAMPLE_SERIES = [
  { label: '1 Jun', facturado: 0, cobrado: 0 },
  { label: '6', facturado: 2100000, cobrado: 1800000 },
  { label: '11', facturado: 900000, cobrado: 850000 },
  { label: '16', facturado: 4200000, cobrado: 3900000 },
  { label: '21', facturado: 1800000, cobrado: 1200000 },
  { label: '26', facturado: 2600000, cobrado: 2400000 },
  { label: '1', facturado: 1100000, cobrado: 900000 },
]

const meta: Meta<typeof PerformanceCard> = {
  title: 'ERP/PerformanceCard',
  component: PerformanceCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    viewport: { defaultViewport: 'mobile1' },
  },
}
export default meta
type Story = StoryObj<typeof PerformanceCard>

export const Default: Story = {
  args: {
    periodLabel: 'Este mes — Junio 2026',
    series: SAMPLE_SERIES,
    facturado: 43675729.11,
    cobrado: 38200000,
    porCobrar: 5475729.11,
    comprobantes: 370,
    clientes: 855,
    lastUpdated: new Date('2026-06-21T01:25:00'),
  },
}

export const Loading: Story = {
  args: {
    ...Default.args,
    loading: true,
  },
}

export const Empty: Story = {
  args: {
    periodLabel: 'Última semana',
    series: [],
    facturado: 0,
    cobrado: 0,
    porCobrar: 0,
    comprobantes: 0,
    clientes: 0,
  },
}
