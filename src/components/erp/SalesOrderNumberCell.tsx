import { WOO_COMMERCE_BRAND } from './WooCommerceIcon'

export interface SalesOrderNumberCellProps {
  erpNumber: string
  wooOrderId?: string | null
}

/** ERP order number with optional WooCommerce # inline (compact list row). */
export function SalesOrderNumberCell({ erpNumber, wooOrderId }: SalesOrderNumberCellProps) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-fg-muted tabular-nums">
      <span>{erpNumber}</span>
      {wooOrderId ? (
        <>
          <span className="text-fg-subtle select-none">·</span>
          <span
            className="font-semibold"
            style={{ color: WOO_COMMERCE_BRAND }}
            title={`WooCommerce #${wooOrderId}`}
          >
            #{wooOrderId}
          </span>
        </>
      ) : null}
    </span>
  )
}
