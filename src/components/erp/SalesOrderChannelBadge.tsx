import { cn } from '@/lib/utils'
import { WOO_COMMERCE_BRAND } from './WooCommerceIcon'
import { SALES_ORDER_CHANNEL_SHORT_LABEL } from '@/modules/sales/sales-order-channel.utils'
import type { SalesOrderSource } from '@/modules/sales/sales-order.model'

export interface SalesOrderChannelBadgeProps {
  source: SalesOrderSource | string | null | undefined
  className?: string
}

const POS_CHANNEL = {
  backgroundColor: '#0EA5E914',
  borderColor: '#0EA5E94D',
  color: '#0369A1',
} as const

const WOO_CHANNEL = {
  backgroundColor: `${WOO_COMMERCE_BRAND}1A`,
  borderColor: `${WOO_COMMERCE_BRAND}4D`,
  color: WOO_COMMERCE_BRAND,
} as const

function isSalesOrderSource(value: string): value is SalesOrderSource {
  return value === 'erp' || value === 'pos' || value === 'woocommerce'
}

/** Badge for sales order channel (Cloud / POS / WooCommerce). */
export function SalesOrderChannelBadge({ source, className }: SalesOrderChannelBadgeProps) {
  if (!source || !isSalesOrderSource(source)) {
    return <span className="text-fg-subtle">—</span>
  }

  const label = SALES_ORDER_CHANNEL_SHORT_LABEL[source]

  if (source === 'erp') {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-sm border border-border-strong bg-surface-hover px-2 py-0.5 text-[11px] font-semibold text-fg-muted',
          className,
        )}
      >
        {label}
      </span>
    )
  }

  const styles = source === 'pos' ? POS_CHANNEL : WOO_CHANNEL

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm border px-2 py-0.5 text-[11px] font-semibold',
        className,
      )}
      style={styles}
    >
      {label}
    </span>
  )
}
