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
      {children}
    </div>
  )
}
