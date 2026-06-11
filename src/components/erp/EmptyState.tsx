import { cn } from '@/lib/utils'
import { Button } from '@/components/primitives/Button'

export interface EmptyStateProps {
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  icon?: React.ReactNode
  className?: string
}

const DefaultIcon = () => (
  <svg
    width="40"
    height="40"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-zinc-300"
  >
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <path d="M3 9h18M9 21V9" />
  </svg>
)

function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-16 text-center', className)}>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100">
        {icon ?? <DefaultIcon />}
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-[14px] font-medium text-zinc-700">{title}</p>
        {description && (
          <p className="text-[12px] text-zinc-400 max-w-xs">{description}</p>
        )}
      </div>
      {action && (
        <Button variant="primary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}

export { EmptyState }
