import { cn } from '@/lib/utils'

interface PageBodyProps {
  children: React.ReactNode
  className?: string
  /** Override padding. Default: 'p-4 md:p-5' */
  padding?: string
}

/**
 * Canonical scrollable body for every ERP page.
 *
 * Sits as the flex-1 sibling of TopBar inside a `flex flex-col h-full` page
 * wrapper. Handles:
 *   - `flex-1 min-h-0 overflow-auto` — fills remaining height and scrolls
 *   - `pb-[env(safe-area-inset-bottom)]` — clears the iOS home indicator on mobile
 *   - Responsive padding: tighter on phones (p-4) than on desktop (p-5)
 */
export function PageBody({ children, className, padding = 'p-4 md:p-5' }: PageBodyProps) {
  return (
    <div
      className={cn(
        'flex-1 min-h-0 overflow-auto',
        'pb-[env(safe-area-inset-bottom,0px)] md:pb-0',
        padding,
        className,
      )}
    >
      {children}
    </div>
  )
}
