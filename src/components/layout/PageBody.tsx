'use client'

import { cn } from '@/lib/utils'
import { PullToRefresh } from './PullToRefresh'

interface PageBodyProps {
  children: React.ReactNode
  className?: string
  /** Override padding. Default: 'p-4 md:p-5' */
  padding?: string
  /** When provided, enables pull-to-refresh on mobile. Callback must return a Promise. */
  onRefresh?: () => Promise<void>
}

export function PageBody({ children, className, padding = 'p-4 md:p-5', onRefresh }: PageBodyProps) {
  if (onRefresh) {
    return (
      <PullToRefresh
        className={cn('flex-1 min-h-0', className)}
        onRefresh={onRefresh}
      >
        <div className={cn(padding, 'pb-[calc(env(safe-area-inset-bottom)+0.5rem)] md:pb-0')}>
          {children}
        </div>
      </PullToRefresh>
    )
  }

  return (
    <div className={cn('flex-1 min-h-0 overflow-auto', padding, className)}>
      <div className="pb-[calc(env(safe-area-inset-bottom)+0.5rem)] md:pb-0">
        {children}
      </div>
    </div>
  )
}
