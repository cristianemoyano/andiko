import type { BarChartDataPoint } from '@/components/erp/PanelBarChart'
import type { DonutSegment } from '@/components/erp/PanelDonutChart'
import type { BillingPreviewLine } from '@/components/erp/billing/BillingPeriodPreviewSection'

const KIND_LABELS: Record<string, string> = {
  base: 'Plan base',
  seat: 'Usuarios extra',
  branch: 'Sucursales extra',
  site: 'Sitios extra',
  module_addon: 'Módulos',
  extra_addon: 'Servicios',
  usage: 'Consumo medido',
  adjustment: 'Ajustes',
  discount: 'Descuentos',
}

const SEGMENT_COLORS = ['#0C647A', '#2DA3BC', '#158799', '#5FC0D3', '#0A5268', '#A2DCE7', '#52525B']

export function previewLinesToDonutSegments(lines: BillingPreviewLine[]): DonutSegment[] {
  const totals = new Map<string, number>()

  for (const line of lines) {
    if (line.isInformational) continue
    const amount = Number(line.amount)
    if (!amount || amount <= 0) continue
    totals.set(line.kind, (totals.get(line.kind) ?? 0) + amount)
  }

  return Array.from(totals.entries()).map(([kind, value], index) => ({
    label: KIND_LABELS[kind] ?? kind,
    value,
    color: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
  }))
}

export function usageLinesToBarData(
  lines: { label: string; amount: string }[],
): BarChartDataPoint[] {
  return lines
    .filter(line => Number(line.amount) > 0)
    .map(line => ({
      label: truncateLabel(line.label),
      value: Number(line.amount),
    }))
}

export function invoicesToBarData(
  invoices: { invoice_number: string; issue_date: string | null; total: string; status: string }[],
): BarChartDataPoint[] {
  return [...invoices]
    .filter(inv => inv.status !== 'void')
    .sort((a, b) => {
      const ta = a.issue_date ? new Date(a.issue_date).getTime() : 0
      const tb = b.issue_date ? new Date(b.issue_date).getTime() : 0
      return ta - tb
    })
    .slice(-6)
    .map(inv => ({
      label: inv.invoice_number.length > 12
        ? inv.invoice_number.slice(-10)
        : inv.invoice_number,
      value: Number(inv.total),
    }))
}

/** Net usage charges that would appear on the next invoice (excludes plan-included quantities). */
export function billableUsageNetFromPreview(lines: BillingPreviewLine[]): string {
  const net = lines
    .filter(line => line.kind === 'usage' && !line.isInformational && Number(line.amount) > 0)
    .reduce((acc, line) => acc + Number(line.amount), 0)
  return net.toFixed(2)
}

export function usageConsumptionHint(registeredTotal: string, billableTotal: string): string {
  const registered = Number(registeredTotal)
  const billable = Number(billableTotal)

  if (registered <= 0) return 'Sin consumo registrado en el período'

  if (billable <= 0) {
    return `Registrado ${formatArsHint(registeredTotal)} · cubierto por lo incluido en tu plan`
  }

  if (billable < registered) {
    return `Registrado ${formatArsHint(registeredTotal)} · solo el excedente suma a la factura`
  }

  return 'Excedente del período que se sumará a la próxima factura'
}

function formatArsHint(value: string): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value))
}

function truncateLabel(label: string, max = 16): string {
  if (label.length <= max) return label
  return `${label.slice(0, max - 1)}…`
}
