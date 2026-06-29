'use client'

import { Card, CardContent, CardHeader } from '@/components/layout'
import { PanelBarChart, PanelDonutChart } from '@/components/erp'
import type { BarChartDataPoint } from '@/components/erp/PanelBarChart'
import type { DonutSegment } from '@/components/erp/PanelDonutChart'
import { BillingCapacityMeters } from '@/components/erp/billing/BillingCapacityMeters'
import { formatARS } from '@/components/primitives/CurrencyInput'

interface BillingOverviewChartsProps {
  estimateSegments: DonutSegment[]
  usageBarData: BarChartDataPoint[]
  invoiceBarData: BarChartDataPoint[]
  capacity: {
    activeUsers: number
    contractedSeats: number
    includedSeats: number
    activeBranches: number
    includedBranches: number
  }
  estimatedSubtotal: string
  estimatedTax: string
  estimatedTotal: string
}

function ChartEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover text-fg-subtle">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M4 19V5M4 19h16M8 17V9M12 17V7M16 17v-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="text-[13px] font-medium text-fg-muted">{title}</p>
      <p className="text-[12px] text-fg-subtle max-w-[240px]">{description}</p>
    </div>
  )
}

export function BillingOverviewCharts({
  estimateSegments,
  usageBarData,
  invoiceBarData,
  capacity,
  estimatedSubtotal,
  estimatedTax,
  estimatedTotal,
}: BillingOverviewChartsProps) {
  const showUsageChart = usageBarData.length > 0
  const showInvoiceChart = !showUsageChart && invoiceBarData.length > 0
  const showCapacity = !showUsageChart && !showInvoiceChart

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Card className="overflow-hidden">
        <CardHeader
          title="Composición estimada"
          description="Desglose neto de tu próxima factura (sin IVA)"
        />
        <CardContent>
          {estimateSegments.length > 0 ? (
            <div className="flex flex-col gap-4">
              <PanelDonutChart segments={estimateSegments} />
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 border-t border-border pt-3 text-[13px]">
                <dt className="text-fg-muted">Subtotal neto</dt>
                <dd className="font-mono tabular-nums text-right text-fg">{formatARS(estimatedSubtotal)}</dd>
                <dt className="text-fg-muted">IVA 21%</dt>
                <dd className="font-mono tabular-nums text-right text-fg">{formatARS(estimatedTax)}</dd>
                <dt className="font-medium text-fg">Total estimado</dt>
                <dd className="font-mono font-semibold tabular-nums text-right text-fg">{formatARS(estimatedTotal)}</dd>
              </dl>
            </div>
          ) : (
            <ChartEmpty
              title="Sin cargos estimados"
              description="Todavía no hay conceptos facturables para el período actual."
            />
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title={showInvoiceChart ? 'Historial reciente' : 'Consumo del período'}
          description={
            showInvoiceChart
              ? 'Últimas facturas emitidas'
              : 'Uso registrado del período (el gráfico muestra el valor bruto; la factura solo cobra excedentes)'
          }
        />
        <CardContent>
          {showUsageChart ? (
            <PanelBarChart data={usageBarData} />
          ) : showInvoiceChart ? (
            <PanelBarChart data={invoiceBarData} color="#158799" />
          ) : (
            <BillingCapacityMeters
              activeUsers={capacity.activeUsers}
              contractedSeats={capacity.contractedSeats}
              includedSeats={capacity.includedSeats}
              activeBranches={capacity.activeBranches}
              includedBranches={capacity.includedBranches}
            />
          )}
          {showCapacity && (
            <p className="mt-3 text-[11px] text-fg-subtle border-t border-border pt-3">
              El consumo medido aparecerá acá cuando haya métricas facturables en el período.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
