import Link from 'next/link'
import { cn } from '@/lib/utils'
import { AndikoMark, type AndikoMarkSize } from './AndikoMark'

interface AndikoLogoProps {
  href?: string
  className?: string
  size?: AndikoMarkSize
  wordmarkClass?: string
}

const wordmarkStyles = {
  '2xs': { text: 'text-xs', gap: 'gap-2' },
  xs: { text: 'text-[15px]', gap: 'gap-2.5' },
  sm: { text: 'text-base', gap: 'gap-2.5' },
  md: { text: 'text-xl', gap: 'gap-3' },
  lg: { text: 'text-2xl', gap: 'gap-3.5' },
  xl: { text: 'text-2xl', gap: 'gap-3.5' },
  '2xl': { text: 'text-3xl', gap: 'gap-4' },
} as const

export function AndikoLogo({
  href = '/',
  className,
  size = 'md',
  wordmarkClass = 'text-fg',
}: AndikoLogoProps) {
  const styles = wordmarkStyles[size]

  const content = (
    <>
      <AndikoMark
        size={size}
        tone="brand"
        className="transition-transform duration-300 group-hover:scale-105"
      />
      <span className={cn('font-semibold tracking-tight', wordmarkClass, styles.text)}>andiko</span>
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        className={cn('group flex items-center', styles.gap, className)}
        aria-label="Andiko — inicio"
      >
        {content}
      </Link>
    )
  }

  return (
    <div className={cn('flex items-center', styles.gap, className)} aria-label="Andiko">
      {content}
    </div>
  )
}
