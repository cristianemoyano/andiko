'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/primitives/Skeleton'
import { KpiInfoIcon, KpiLabel } from './KpiInfoIcon'
import { Tooltip } from '@/components/primitives/Tooltip'
import { panelTrendPillTooltip, withPanelTrendInfo } from './panel-kpi-trend-info'
import { PanelWidgetMenu } from './PanelWidgetMenu'
import { PanelWidgetSlot } from './PanelWidgetSlot'
import type { PanelWidgetId } from '@/modules/panel/panel-widget.types'
import { Sparkline } from './Sparkline'
import type { PanelAnalytics as PanelAnalyticsData, PanelMetricWithTrend, PanelTopProduct } from '@/modules/panel/panel.types'

export interface PanelAnalyticsProps {
  periodLabel: string
  comparePeriodLabel: string
  analytics: PanelAnalyticsData | null
  lastUpdated?: Date
  loading?: boolean
  className?: string
}

const SPARK_POSITIVE = '#16A34A'
const SPARK_NEGATIVE = '#DC2626'

const KPI_INFO = {
  total_sales:
    'Suma del total de facturas emitidas en el período (excluye borradores y anulados). Incluye IVA y descuentos ya aplicados en cada línea.',
  net_sales:
    'Suma del subtotal de facturas: cantidad × precio unitario por línea, sin IVA. No resta descuentos de línea (van en un campo aparte).',
  total_orders:
    'Cantidad de comprobantes de venta emitidos en el período. Excluye borradores y anulados.',
  avg_order_value:
    'Ventas totales del período dividido la cantidad de comprobantes. Indica cuánto factura en promedio cada venta.',
  items_sold:
    'Suma de unidades facturadas en todas las líneas del período, sin importar el producto.',
  product_net:
    'Importe de la línea (cantidad × precio unitario) sin IVA. No incluye descuentos de línea.',
} as const

const formatARS = (v: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(v)

const formatCompactCount = (v: number) => {
  const abs = Math.abs(v)
  if (abs >= 1000) {
    return `${(v / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}k`
  }
  return v.toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

function formatUpdatedAt(date: Date): string {
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function TrendPill({ pct, comparePeriodLabel }: { pct: number; comparePeriodLabel?: string }) {
  if (pct === 0) return null
  const positive = pct > 0
  const pill = (
    <span
      className={cn(
        'text-[11px] font-semibold px-1.5 py-0.5 rounded shrink-0 cursor-help',
        positive ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger',
      )}
    >
      {positive ? '+' : ''}{pct} %
    </span>
  )
  return (
    <Tooltip content={panelTrendPillTooltip(pct, comparePeriodLabel)} side="top">
      {pill}
    </Tooltip>
  )
}

function MetricCell({
  label,
  info,
  value,
  metric,
  loading,
  comparePeriodLabel,
}: {
  label: string
  info?: string
  value: React.ReactNode
  metric?: PanelMetricWithTrend
  loading?: boolean
  comparePeriodLabel?: string
}) {
  const sparkColor = metric && metric.pct_change >= 0 ? SPARK_POSITIVE : SPARK_NEGATIVE
  const tooltipInfo = info ? withPanelTrendInfo(info, comparePeriodLabel) : undefined

  return (
    <div className="flex flex-col gap-1.5 min-w-0 flex-1">
      <KpiLabel label={label} info={tooltipInfo} labelClassName="text-[11px] text-fg-muted" />
      <div className="flex items-center gap-2 min-w-0">
        <div className="font-mono text-xl sm:text-2xl font-medium text-fg leading-none truncate">
          {loading ? <Skeleton className="h-7 w-24" /> : value}
        </div>
        {!loading && metric && (
          <TrendPill pct={metric.pct_change} comparePeriodLabel={comparePeriodLabel} />
        )}
      </div>
      {!loading && metric && metric.spark.length > 1 && (
        <Sparkline data={metric.spark} color={sparkColor} height={28} />
      )}
    </div>
  )
}

function SectionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-center gap-1 py-3 text-[13px] font-medium text-brand-accent hover:underline border-t border-border"
    >
      {label}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </Link>
  )
}

function AnalyticsSection({
  title,
  widgetId,
  children,
  reportHref,
  reportLabel,
}: {
  title: string
  widgetId: PanelWidgetId
  children: React.ReactNode
  reportHref: string
  reportLabel: string
}) {
  return (
    <PanelWidgetSlot widgetId={widgetId}>
      <div className="bg-surface border border-border rounded-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
        <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-2">
          <div className="text-[11px] font-semibold text-fg-subtle uppercase tracking-[0.06em]">{title}</div>
          <PanelWidgetMenu widgetId={widgetId} />
        </div>
        <div className="px-4 pb-4 flex gap-4">{children}</div>
        <SectionLink href={reportHref} label={reportLabel} />
      </div>
    </PanelWidgetSlot>
  )
}

export function PanelAnalyticsCompareLabel({ label }: { label: string }) {
  if (!label) return null
  return (
    <div className="text-[11px] text-fg-muted px-0.5">
      <span className="font-medium text-fg-subtle">Base de comparación: </span>
      {label.replace(/^Comparado con\s+/i, '')}
    </div>
  )
}

export function PanelAnalyticsRevenueSection({
  analytics,
  loading,
  comparePeriodLabel,
}: {
  analytics: PanelAnalyticsData | null
  loading?: boolean
  comparePeriodLabel?: string
}) {
  const revenue = analytics?.revenue
  const compare = comparePeriodLabel ?? analytics?.compare_period_label
  return (
    <AnalyticsSection title="Ingresos" widgetId="analytics_revenue" reportHref="/ventas/reportes" reportLabel="Ver reporte">
      <MetricCell
        label="Ventas totales"
        info={KPI_INFO.total_sales}
        value={revenue ? formatARS(revenue.total_sales.value) : null}
        metric={revenue?.total_sales}
        loading={loading}
        comparePeriodLabel={compare}
      />
      <MetricCell
        label="Ventas netas"
        info={KPI_INFO.net_sales}
        value={revenue ? formatARS(revenue.net_sales.value) : null}
        metric={revenue?.net_sales}
        loading={loading}
        comparePeriodLabel={compare}
      />
    </AnalyticsSection>
  )
}

export function PanelAnalyticsOrdersSection({
  analytics,
  loading,
  comparePeriodLabel,
}: {
  analytics: PanelAnalyticsData | null
  loading?: boolean
  comparePeriodLabel?: string
}) {
  const orders = analytics?.orders
  const compare = comparePeriodLabel ?? analytics?.compare_period_label
  return (
    <AnalyticsSection title="Pedidos" widgetId="analytics_orders" reportHref="/ventas/facturas" reportLabel="Ver reporte">
      <MetricCell
        label="Total pedidos"
        info={KPI_INFO.total_orders}
        value={orders ? orders.total_orders.value.toLocaleString('es-AR') : null}
        metric={orders?.total_orders}
        loading={loading}
        comparePeriodLabel={compare}
      />
      <MetricCell
        label="Ticket promedio"
        info={KPI_INFO.avg_order_value}
        value={orders ? formatARS(orders.avg_order_value.value) : null}
        metric={orders?.avg_order_value}
        loading={loading}
        comparePeriodLabel={compare}
      />
    </AnalyticsSection>
  )
}

export function PanelAnalyticsProductsSection({
  periodLabel,
  analytics,
  lastUpdated,
  loading,
  comparePeriodLabel,
}: {
  periodLabel: string
  analytics: PanelAnalyticsData | null
  lastUpdated?: Date
  loading?: boolean
  comparePeriodLabel?: string
}) {
  const products = analytics?.products
  const compare = comparePeriodLabel ?? analytics?.compare_period_label
  return (
    <PanelWidgetSlot widgetId="analytics_products">
      <div className="bg-surface border border-border rounded-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between gap-2 border-b border-border">
          <span className="text-[13px] font-semibold text-fg">Mejores productos</span>
          <PanelWidgetMenu widgetId="analytics_products" />
        </div>
        <div className="px-4 py-2 text-[12px] text-fg-muted flex items-center gap-1.5 border-b border-border">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {periodLabel}
        </div>
        <div className="px-4 py-3 border-b border-border">
          <MetricCell
            label="Unidades vendidas"
            info={KPI_INFO.items_sold}
            value={products ? formatCompactCount(products.items_sold.value) : null}
            metric={products?.items_sold}
            loading={loading}
            comparePeriodLabel={compare}
          />
        </div>
        <div className="px-4 pb-1">
          <div className="flex items-center text-[11px] font-semibold text-fg-subtle uppercase tracking-[0.03em] border-b border-border pb-2">
            <span className="flex-1">Productos</span>
            <span className="shrink-0">Unidades</span>
          </div>
          {loading ? (
            <div className="py-2 flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : products && products.top.length > 0 ? (
            products.top.map(p => <TopProductRow key={p.id} product={p} />)
          ) : (
            <div className="py-6 text-sm text-fg-subtle text-center">Sin ventas de productos en el período</div>
          )}
        </div>
        {lastUpdated && (
          <div className="text-center text-[11px] text-fg-subtle py-2 border-t border-border">
            Actualizado: {formatUpdatedAt(lastUpdated)}
          </div>
        )}
        <SectionLink href="/ventas/reportes?group_by=product" label="Ver reportes de ventas" />
      </div>
    </PanelWidgetSlot>
  )
}

function ProductThumb({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external product URLs from catalog
      <img
        src={imageUrl}
        alt={name}
        className="w-10 h-10 rounded-[4px] object-cover bg-surface-muted shrink-0 border border-border"
      />
    )
  }
  return (
    <div className="w-10 h-10 rounded-[4px] bg-surface-muted border border-border shrink-0 flex items-center justify-center text-fg-subtle">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
      </svg>
    </div>
  )
}

function TopProductRow({ product }: { product: PanelTopProduct }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      <ProductThumb name={product.name} imageUrl={product.image_url} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-fg leading-snug line-clamp-2">{product.name}</div>
        <div className="text-[11px] text-fg-muted mt-0.5 flex items-center gap-1">
          <span>Neto: {formatARS(product.net_sales)}</span>
          <KpiInfoIcon content={KPI_INFO.product_net} ariaLabel="Más información sobre neto de línea" />
        </div>
      </div>
      <div className="font-mono text-[13px] font-medium text-fg shrink-0 tabular-nums">
        {formatCompactCount(product.quantity_sold)}
      </div>
    </div>
  )
}

export function PanelAnalytics({
  periodLabel,
  comparePeriodLabel,
  analytics,
  lastUpdated,
  loading,
  className,
}: PanelAnalyticsProps) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <PanelAnalyticsCompareLabel label={comparePeriodLabel} />
      <PanelAnalyticsRevenueSection analytics={analytics} loading={loading} />
      <PanelAnalyticsOrdersSection analytics={analytics} loading={loading} />
      <PanelAnalyticsProductsSection
        periodLabel={periodLabel}
        analytics={analytics}
        lastUpdated={lastUpdated}
        loading={loading}
      />
    </div>
  )
}
