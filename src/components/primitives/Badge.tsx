import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-sm border text-[11px] font-medium px-2 py-0.5',
  {
    variants: {
      status: {
        success:  'bg-success-bg text-success border-success',
        pending:  'bg-warning-bg text-warning border-warning',
        error:    'bg-danger-bg   text-danger   border-danger',
        draft:    'bg-surface-hover  text-fg-muted  border-border-strong',
        info:     'bg-brand-100 text-brand-800 border-brand-200',
        neutral:  'bg-surface-hover  text-fg-muted  border-border',
      },
    },
    defaultVariants: { status: 'neutral' },
  }
)

const dotColor: Record<string, string> = {
  success: 'bg-green-600',
  pending: 'bg-amber-600',
  error:   'bg-red-600',
  draft:   'bg-fg-subtle',
  info:    'bg-brand-600',
  neutral: 'bg-fg-subtle',
}

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
}

export function Badge({ className, status, dot = false, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ status }), className)} {...props}>
      {dot && (
        <span
          className={cn('inline-block w-1.5 h-1.5 rounded-full flex-shrink-0', dotColor[status ?? 'neutral'])}
        />
      )}
      {children}
    </span>
  )
}

const STATUS_LABELS: Record<string, { status: BadgeProps['status']; label: string }> = {
  Aprobado:    { status: 'success', label: 'Aprobado' },
  Pendiente:   { status: 'pending', label: 'Pendiente' },
  Anulado:     { status: 'error',   label: 'Anulado' },
  Borrador:    { status: 'draft',   label: 'Borrador' },
  'En proceso':{ status: 'info',    label: 'En proceso' },
}

export function StatusBadge({ value, className }: { value: string; className?: string }) {
  const config = STATUS_LABELS[value] ?? { status: 'neutral' as const, label: value }
  return (
    <Badge status={config.status} dot className={className}>
      {config.label}
    </Badge>
  )
}
