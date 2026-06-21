'use client'

import { LineChart, Line, ResponsiveContainer } from 'recharts'

import { BRAND_CHART_COLOR } from '@/lib/brand-colors'

interface SparklineProps {
  data: number[]
  color?: string
  height?: number
}

export function Sparkline({ data, color = BRAND_CHART_COLOR, height = 32 }: SparklineProps) {
  const chartData = data.map((v, i) => ({ i, v }))
  return (
    <ResponsiveContainer width={72} height={height}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
