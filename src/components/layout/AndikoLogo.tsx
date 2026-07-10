import Link from 'next/link'
import { cn } from '@/lib/utils'

interface AndikoLogoProps {
  href?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
  wordmarkClass?: string
}

const sizeStyles = {
  sm: {
    mark: 'h-8 w-8 rounded-[7px]',
    icon: 'h-4 w-4',
    text: 'text-base',
    gap: 'gap-2.5',
  },
  md: {
    mark: 'h-10 w-10 rounded-[9px]',
    icon: 'h-5 w-5',
    text: 'text-xl',
    gap: 'gap-3',
  },
  lg: {
    mark: 'h-12 w-12 rounded-[11px]',
    icon: 'h-6 w-6',
    text: 'text-2xl',
    gap: 'gap-3.5',
  },
} as const

export function AndikoLogo({ href = '/', className, size = 'md', wordmarkClass = 'text-fg' }: AndikoLogoProps) {
  const styles = sizeStyles[size]

  const content = (
    <>
      <div
        className={cn(
          'flex flex-shrink-0 items-center justify-center bg-brand-600 shadow-md shadow-brand-600/25 transition-transform duration-300 group-hover:scale-105',
          styles.mark,
        )}
      >
        <svg viewBox="0 0 64 64" className={cn(styles.icon)} fill="none" aria-hidden>
          <path d="M13 55 L28 11 L36 11 L51 55" stroke="white" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
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
