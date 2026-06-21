import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const skeletonVariants = cva('animate-pulse bg-surface-hover', {
  variants: {
    shape: {
      line: 'rounded-sm',
      block: 'rounded-[4px]',
      circle: 'rounded-full',
    },
  },
  defaultVariants: { shape: 'line' },
})

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {}

/**
 * Loading placeholder. Use sized to the content it replaces so the layout
 * does not shift when the real data arrives. Prefer this over a `Cargando…`
 * text string for a more native, app-like loading feel.
 */
export function Skeleton({ className, shape, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(skeletonVariants({ shape }), className)}
      {...props}
    />
  )
}
