import { cn } from '@/lib/utils'

interface PageBodyProps {
  children: React.ReactNode
  className?: string
  /** Override padding. Default: 'p-4 md:p-5' */
  padding?: string
}

export function PageBody({ children, className, padding = 'p-4 md:p-5' }: PageBodyProps) {
  return (
    <div
      className={cn(
        'flex-1 min-h-0 overflow-auto',
        padding,
        className,
      )}
    >
      <div className="pb-[calc(env(safe-area-inset-bottom)+0.5rem)] md:pb-0">
        {children}
      </div>
    </div>
  )
}
