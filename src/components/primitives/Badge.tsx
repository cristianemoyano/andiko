import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-sm border text-[11px] font-medium px-2 py-0.5',
  {
    variants: {
      status: {
        success:  'bg-green-100 text-green-900 border-green-300',
        pending:  'bg-amber-100 text-amber-900 border-amber-300',
        error:    'bg-red-100   text-red-900   border-red-300',
        draft:    'bg-zinc-100  text-zinc-600  border-zinc-300',
        info:     'bg-brand-100 text-brand-800 border-brand-200',
        neutral:  'bg-zinc-100  text-zinc-700  border-zinc-200',
      },
    },
    defaultVariants: { status: 'neutral' },
  }
)

const dotColor: Record<string, string> = {
  success: 'bg-green-600',
  pending: 'bg-amber-600',
  error:   'bg-red-600',
  draft:   'bg-zinc-400',
  info:    'bg-brand-600',
  neutral: 'bg-zinc-400',
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
