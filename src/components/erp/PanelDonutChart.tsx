'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

export interface DonutSegment {
  label: string
  value: number
  color: string
}

interface PanelDonutChartProps {
  segments: DonutSegment[]
}

const formatARS = (v: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v)

export function PanelDonutChart({ segments }: PanelDonutChartProps) {
  const total = segments.reduce((a, s) => a + s.value, 0)
  return (
    <div className="flex items-center gap-5">
      <ResponsiveContainer width={140} height={140}>
        <PieChart>
          <Pie
            data={segments}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={44}
            outerRadius={62}
            strokeWidth={0}
          >
            {segments.map((seg, i) => (
              <Cell key={i} fill={seg.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => [typeof v === 'number' ? formatARS(v) : String(v ?? '')]}
            contentStyle={{ border: '1px solid #E4E4E7', borderRadius: 4, fontSize: 12, fontFamily: 'inherit' }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-2">
        {segments.map((seg, i) => {
          const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0
          return (
            <div key={i} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: seg.color }} />
              <div>
                <div className="text-[11px] text-fg-muted">{seg.label}</div>
                <div className="text-[10px] text-fg-subtle font-mono">{pct}%</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
