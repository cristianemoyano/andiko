import { formatLocalDateTime } from '@/lib/date-only'
import { WOO_COMMERCE_BRAND } from './WooCommerceIcon'

export interface SalesOrderDateCellProps {
  erpCreatedAt: string
  wooOrderCreatedAt?: string | null
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  )
}

function formatWooDateTime(erp: Date, woo: Date): string {
  if (sameLocalDay(erp, woo)) {
    return woo.toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit' })
  }
  return formatLocalDateTime(woo)
}

/** ERP creation datetime with optional WooCommerce storefront time inline. */
export function SalesOrderDateCell({ erpCreatedAt, wooOrderCreatedAt }: SalesOrderDateCellProps) {
  const erp = new Date(erpCreatedAt)
  const erpLabel = formatLocalDateTime(erp)

  if (!wooOrderCreatedAt) {
    return (
      <span className="text-[12px] text-fg-muted tabular-nums whitespace-nowrap" title="Creado en ERP">
        {erpLabel}
      </span>
    )
  }

  const woo = new Date(wooOrderCreatedAt)
  const wooLabel = formatWooDateTime(erp, woo)
  const wooFull = formatLocalDateTime(woo)

  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] tabular-nums whitespace-nowrap">
      <span className="text-fg-muted" title={`Importado al ERP: ${erpLabel}`}>
        {erpLabel}
      </span>
      <span className="text-fg-subtle select-none">·</span>
      <span
        className="font-medium"
        style={{ color: WOO_COMMERCE_BRAND }}
        title={`WooCommerce (UTC guardado): ${wooFull}`}
      >
        Woo {wooLabel}
      </span>
    </span>
  )
}
