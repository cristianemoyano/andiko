import { cn } from '@/lib/utils'

export type AndikoMarkSize = '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
export type AndikoMarkTone = 'brand' | 'muted'

const sizeStyles = {
  '2xs': { box: 'h-4 w-4 rounded-[3px]', icon: 'h-2 w-2' },
  xs: { box: 'h-[22px] w-[22px] rounded-sm', icon: 'h-3 w-3' },
  sm: { box: 'h-8 w-8 rounded-[7px]', icon: 'h-4 w-4' },
  md: { box: 'h-10 w-10 rounded-[9px]', icon: 'h-5 w-5' },
  lg: { box: 'h-11 w-11 rounded-lg', icon: 'h-5 w-5' },
  xl: { box: 'h-12 w-12 rounded-[11px]', icon: 'h-6 w-6' },
  '2xl': { box: 'h-[52px] w-[52px] rounded-[11px]', icon: 'h-[26px] w-[26px]' },
} as const

const toneStyles = {
  brand: 'bg-brand-600 shadow-md shadow-brand-600/25',
  muted: 'bg-white/10',
}

export function AndikoMarkGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden>
      <path
        d="M13 55 L28 11 L36 11 L51 55"
        stroke="white"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Andiko A-mark tile. Use `tone="muted"` for subtle co-branding placements. */
export function AndikoMark({
  size = 'sm',
  tone = 'brand',
  className,
}: {
  size?: AndikoMarkSize
  tone?: AndikoMarkTone
  className?: string
}) {
  const styles = sizeStyles[size]

  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex flex-shrink-0 items-center justify-center',
        toneStyles[tone],
        styles.box,
        className,
      )}
    >
      <AndikoMarkGlyph className={styles.icon} />
    </span>
  )
}

/** Andiko mark + "powered by Andiko" wordmark for unobtrusive co-branding. */
export function PoweredByAndiko({
  className,
  labelClassName,
}: {
  className?: string
  labelClassName?: string
}) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <AndikoMark size="2xs" tone="muted" />
      <span className={cn('text-[9px] font-medium leading-none tracking-wide', labelClassName)}>
        powered by <span className="font-semibold">Andiko</span>
      </span>
    </div>
  )
}
