type MarkSize = 'xs' | 'sm' | 'md' | 'lg'

const BOX_CLASSES: Record<MarkSize, string> = {
  xs: 'w-4 h-4 rounded-[3px]',
  sm: 'w-5 h-5 rounded-sm',
  md: 'w-7 h-7 rounded-md',
  lg: 'w-11 h-11 rounded-lg',
}

const GLYPH_CLASSES: Record<MarkSize, string> = {
  xs: 'w-2 h-2',
  sm: 'w-2.5 h-2.5',
  md: 'w-3.5 h-3.5',
  lg: 'w-5 h-5',
}

/** Andiko brand glyph. Set `tone` to "muted" for subtle "powered by" placements. */
export function AndikoMark({
  size = 'sm',
  tone = 'brand',
  className = '',
}: {
  size?: MarkSize
  tone?: 'brand' | 'muted'
  className?: string
}) {
  const boxTone = tone === 'brand' ? 'bg-brand-600' : 'bg-white/10'
  return (
    <span
      aria-hidden
      className={`inline-flex items-center justify-center ${boxTone} ${BOX_CLASSES[size]} ${className}`}
    >
      <svg viewBox="0 0 12 12" className={`fill-white ${GLYPH_CLASSES[size]}`}>
        <rect x="0" y="1" width="3" height="10" />
        <rect x="0" y="1" width="12" height="3" />
        <rect x="9" y="1" width="3" height="10" />
        <rect x="2" y="5" width="8" height="2.5" />
      </svg>
    </span>
  )
}

/** Andiko glyph + "powered by Andiko" wordmark, for unobtrusive co-branding. */
export function PoweredByAndiko({
  className = '',
  labelClassName = '',
}: {
  className?: string
  labelClassName?: string
}) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <AndikoMark size="xs" tone="muted" />
      <span className={`text-[9px] leading-none font-medium tracking-wide ${labelClassName}`}>
        powered by <span className="font-semibold">Andiko</span>
      </span>
    </div>
  )
}
