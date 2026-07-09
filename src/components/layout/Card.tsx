import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const cardVariants = cva('rounded-md bg-surface', {
  variants: {
    variant: {
      default: 'border border-border',
      elevated: 'border border-border shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.24)]',
    },
  },
  defaultVariants: { variant: 'default' },
})

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

function Card({ className, variant, ...props }: CardProps) {
  return <div className={cn(cardVariants({ variant }), className)} {...props} />
}

export interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode
  description?: React.ReactNode
  /** Slot de acciones alineado a la derecha (botones, menús). */
  actions?: React.ReactNode
}

function CardHeader({ title, description, actions, className, children, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn('flex items-start justify-between gap-4 border-b border-border px-4 py-3', className)}
      {...props}
    >
      <div className="min-w-0">
        {title && <h3 className="text-[14px] font-semibold text-fg leading-snug">{title}</h3>}
        {description && <p className="mt-0.5 text-[12px] text-fg-muted">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 py-3', className)} {...props} />
}

function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center justify-end gap-2 border-t border-border px-4 py-3', className)}
      {...props}
    />
  )
}

export { Card, CardHeader, CardContent, CardFooter, cardVariants }
