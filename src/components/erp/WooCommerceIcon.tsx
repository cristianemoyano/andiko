import { cn } from '@/lib/utils'

export interface WooCommerceIconProps {
  size?: number
  className?: string
  /** Tile with brand color + white woo (header). Letters only for purple buttons. */
  variant?: 'mark' | 'glyph'
}

export const WOO_COMMERCE_BRAND = '#7F54B3'

/** WooCommerce logomark — purple tile + lowercase woo (readable at small sizes). */
export function WooCommerceIcon({ size = 16, className, variant = 'mark' }: WooCommerceIconProps) {
  if (variant === 'glyph') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 16"
        fill="currentColor"
        className={cn('shrink-0', className)}
        aria-hidden
      >
        <text
          x="16"
          y="12.5"
          textAnchor="middle"
          fontSize="13"
          fontWeight="700"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
          letterSpacing="-0.4"
        >
          woo
        </text>
      </svg>
    )
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={cn('shrink-0', className)}
      aria-hidden
    >
      <rect width="32" height="32" rx="7" fill={WOO_COMMERCE_BRAND} />
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fill="#fff"
        fontSize="12"
        fontWeight="700"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
        letterSpacing="-0.35"
      >
        woo
      </text>
    </svg>
  )
}
