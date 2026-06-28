import { StatusBadge } from '@/components/primitives/Badge'
import { ORDER_STATUS_LABEL } from '@/modules/printing/labels'
import { WooOrderStatusBadge } from './WooOrderStatusBadge'

export interface SalesOrderStatusCellProps {
  erpStatus: string
  wooStatusLabel?: string | null
}

/** ERP + WooCommerce status badges on one compact row. */
export function SalesOrderStatusCell({ erpStatus, wooStatusLabel }: SalesOrderStatusCellProps) {
  const erpLabel = ORDER_STATUS_LABEL[erpStatus] ?? erpStatus

  return (
    <div className="flex items-center gap-1 flex-wrap max-w-[220px]">
      <StatusBadge value={erpLabel} className="shrink-0" />
      {wooStatusLabel ? (
        <WooOrderStatusBadge
          label={wooStatusLabel}
          className="shrink-0 text-[10px] px-1.5 py-0 leading-tight"
          title={`WooCommerce: ${wooStatusLabel}`}
        />
      ) : null}
    </div>
  )
}
