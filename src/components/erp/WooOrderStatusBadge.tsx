import { cn } from '@/lib/utils'
import { WOO_COMMERCE_BRAND } from './WooCommerceIcon'

export interface WooOrderStatusBadgeProps {
  label: string
  className?: string
  title?: string
}

/** Badge for the raw WooCommerce order status on ERP order detail. */
export function WooOrderStatusBadge({ label, className, title }: WooOrderStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm border px-2.5 py-1 text-[12px] font-semibold',
        className,
      )}
      style={{
        backgroundColor: `${WOO_COMMERCE_BRAND}1A`,
        borderColor: `${WOO_COMMERCE_BRAND}4D`,
        color: WOO_COMMERCE_BRAND,
      }}
      title={title}
    >
      {label}
    </span>
  )
}
