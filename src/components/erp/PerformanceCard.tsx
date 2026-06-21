'use client'

import { useId, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BRAND_CHART_COLOR } from '@/lib/brand-colors'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/primitives/Skeleton'
import { KpiInfoIcon, KpiLabel } from './KpiInfoIcon'

export type PerformanceMetric = 'total' | 'cobrado' | 'pendiente'

export interface PerformanceSeriesPoint {
  label: string
  facturado: number
  cobrado: number
}

export interface PerformanceCardProps {
  periodLabel: string
  series: PerformanceSeriesPoint[]
  facturado: number
  cobrado: number
  porCobrar: number
  comprobantes: number
  clientes: number
  lastUpdated?: Date
  loading?: boolean
  footerHref?: string
  footerLabel?: string
  color?: string
  className?: string
  /** Slot for panel widget menu (three dots). */
  headerAction?: React.ReactNode
}

const METRIC_OPTIONS: { value: PerformanceMetric; label: string; info: string }[] = [
  {
    value: 'total',
    label: 'Total',
    info: 'Total facturado en el período. Incluye IVA. Excluye borradores y anulados.',
  },
  {
    value: 'cobrado',
    label: 'Cobrado',
    info: 'Pagos registrados en el período, según fecha de cobro.',
  },
  {
    value: 'pendiente',
    label: 'Pendiente',
    info: 'Saldo sin cobrar de lo facturado en el período (facturado menos cobrado en el gráfico).',
  },
]

const SECONDARY_STAT_INFO = {
  comprobantes: 'Cantidad de comprobantes de venta emitidos en el período del filtro.',
  clientes: 'Total de clientes activos en la organización (no varía con el período).',
  cobranza: 'Porcentaje cobrado sobre lo facturado en el período seleccionado.',
} as const

const formatARS = (v: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(v)

const formatCompactARS = (v: number) => {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) {
    return `$ ${(v / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}M`
  }
  if (abs >= 1_000) {
    return `$ ${(v / 1_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}K`
  }
  return formatARS(v)
}

function metricValue(metric: PerformanceMetric, facturado: number, cobrado: number, porCobrar: number): number {
  if (metric === 'cobrado') return cobrado
  if (metric === 'pendiente') return porCobrar
  return facturado
}

function seriesForMetric(series: PerformanceSeriesPoint[], metric: PerformanceMetric) {
  return series.map(point => ({
    label: point.label,
    value:
      metric === 'cobrado'
        ? point.cobrado
        : metric === 'pendiente'
          ? Math.max(point.facturado - point.cobrado, 0)
          : point.facturado,
  }))
}

function formatUpdatedAt(date: Date): string {
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

export function PerformanceCard({
  periodLabel,
  series,
  facturado,
  cobrado,
  porCobrar,
  comprobantes,
  clientes,
  lastUpdated,
  loading = false,
  footerHref = '/ventas/reportes',
  footerLabel = 'Ver reportes de ventas',
  color = BRAND_CHART_COLOR,
  className,
  headerAction,
}: PerformanceCardProps) {
  const [metric, setMetric] = useState<PerformanceMetric>('total')
  const gradientId = useId().replace(/:/g, '')

  const chartData = useMemo(() => seriesForMetric(series, metric), [series, metric])
  const primaryValue = metricValue(metric, facturado, cobrado, porCobrar)
  const cobranzaPct = facturado > 0 ? Math.round((cobrado / facturado) * 1000) / 10 : 0

  const secondaryStats = [
    { label: 'Comprobantes', value: comprobantes.toLocaleString('es-AR'), info: SECONDARY_STAT_INFO.comprobantes },
    { label: 'Clientes', value: clientes.toLocaleString('es-AR'), info: SECONDARY_STAT_INFO.clientes },
    { label: 'Cobranza', value: `${cobranzaPct.toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`, info: SECONDARY_STAT_INFO.cobranza },
  ]

  const activeMetric = METRIC_OPTIONS.find(m => m.value === metric)

  return (
    <section
      className={cn(
        'bg-surface border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden',
        className,
      )}
      aria-label="Rendimiento"
    >
      <div className="px-4 pt-4 pb-3 md:px-5 md:pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-fg">Rendimiento</h2>
            <p className="text-xs text-fg-muted mt-0.5 truncate">{periodLabel}</p>
          </div>
          {headerAction ? (
            <div className="shrink-0">{headerAction}</div>
          ) : null}
        </div>

        <div
          role="tablist"
          aria-label="Métrica de rendimiento"
          className="mt-4 inline-flex rounded-lg bg-surface-muted p-0.5 border border-border"
        >
          {METRIC_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={metric === opt.value}
              onClick={() => setMetric(opt.value)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                metric === opt.value
                  ? 'bg-surface text-fg shadow-sm'
                  : 'text-fg-muted hover:text-fg',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {loading ? (
            <Skeleton className="h-9 w-48 max-w-full" />
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <p className="font-mono text-2xl sm:text-[28px] font-semibold text-fg leading-none tracking-tight truncate">
                {formatARS(primaryValue)}
              </p>
              {activeMetric?.info ? (
                <KpiInfoIcon content={activeMetric.info} ariaLabel={`Más información sobre ${activeMetric.label}`} />
              ) : null}
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-4">
          {secondaryStats.map(stat => (
            <div key={stat.label} className="min-w-0">
              {loading ? (
                <Skeleton className="h-6 w-14 mb-1" />
              ) : (
                <p className="font-mono text-lg sm:text-xl font-semibold text-fg leading-none truncate">
                  {stat.value}
                </p>
              )}
              <KpiLabel label={stat.label} info={stat.info} labelClassName="text-[11px] text-fg-muted mt-1" />
            </div>
          ))}
        </div>

        {lastUpdated && !loading && (
          <p className="mt-3 text-[11px] text-fg-subtle text-center">
            Actualizado: {formatUpdatedAt(lastUpdated)}
          </p>
        )}
      </div>

      <div className="px-2 sm:px-4 pb-2">
        {loading ? (
          <Skeleton shape="block" className="h-44 w-full rounded-lg" />
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={176}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'var(--color-fg-subtle)', fontFamily: 'inherit' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                width={44}
                tickFormatter={formatCompactARS}
                tick={{ fontSize: 10, fill: 'var(--color-fg-subtle)', fontFamily: 'inherit' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v) => [typeof v === 'number' ? formatARS(v) : String(v ?? ''), METRIC_OPTIONS.find(m => m.value === metric)?.label ?? '']}
                contentStyle={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  fontSize: 12,
                  fontFamily: 'inherit',
                  background: 'var(--color-surface)',
                }}
                labelStyle={{ color: 'var(--color-fg-muted)', fontSize: 11 }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-44 flex items-center justify-center text-sm text-fg-subtle">
            Sin datos en el período
          </div>
        )}
      </div>

      {footerHref && (
        <Link
          href={footerHref}
          className="flex items-center justify-between px-4 py-3 border-t border-border text-sm font-medium text-brand-accent hover:bg-surface-hover transition-colors"
        >
          <span>{footerLabel}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      )}
    </section>
  )
}
