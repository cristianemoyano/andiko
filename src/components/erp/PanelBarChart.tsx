'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export interface BarChartDataPoint {
  label: string
  value: number
}

interface PanelBarChartProps {
  data: BarChartDataPoint[]
  color?: string
}

const formatARS = (v: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v)

export function PanelBarChart({ data, color = '#0C647A' }: PanelBarChartProps) {
  const chartData = data.map(d => ({ name: d.label, value: d.value }))
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={chartData} barCategoryGap="35%">
        <CartesianGrid vertical={false} stroke="#F4F4F5" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: '#A1A1AA', fontFamily: 'inherit' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide />
        <Tooltip
          cursor={{ fill: '#F4F4F5' }}
          formatter={(v) => [typeof v === 'number' ? formatARS(v) : String(v ?? ''), 'Importe']}
          contentStyle={{
            border: '1px solid #E4E4E7',
            borderRadius: 4,
            fontSize: 12,
            fontFamily: 'inherit',
          }}
          labelStyle={{ color: '#71717A', fontSize: 11 }}
        />
        <Bar dataKey="value" fill={color} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
