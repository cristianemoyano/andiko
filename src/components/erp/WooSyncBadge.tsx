import { cn } from '@/lib/utils'
import { WOO_COMMERCE_BRAND } from './WooCommerceIcon'

export interface WooSyncBadgeProps {
  synced: boolean
  className?: string
}

/** List/table badge for records linked to WooCommerce — uses the integration brand color. */
export function WooSyncBadge({ synced, className }: WooSyncBadgeProps) {
  if (!synced) return <span className="text-fg-subtle">—</span>

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm border px-2 py-0.5 text-[11px] font-semibold',
        className,
      )}
      style={{
        backgroundColor: `${WOO_COMMERCE_BRAND}1A`,
        borderColor: `${WOO_COMMERCE_BRAND}4D`,
        color: WOO_COMMERCE_BRAND,
      }}
    >
      Woo
    </span>
  )
}
