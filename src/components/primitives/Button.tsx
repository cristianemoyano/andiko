import { forwardRef } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 font-medium rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:bg-surface-hover disabled:text-fg-subtle disabled:border-border cursor-pointer',
  {
    variants: {
      variant: {
        primary:   'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 focus-visible:ring-brand-600',
        secondary: 'bg-surface text-fg border border-border-strong hover:bg-surface-hover active:bg-surface-hover focus-visible:ring-border-strong',
        ghost:     'text-fg-muted hover:bg-surface-hover active:bg-surface-hover focus-visible:ring-border-strong',
        danger:    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-600',
      },
      size: {
        xs: 'h-6 px-2.5 text-[11px]',
        sm: 'h-8 px-3.5 text-[13px]',
        md: 'h-9 px-4 text-sm',
        lg: 'h-10 px-4.5 text-sm',
      },
    },
    defaultVariants: { variant: 'primary', size: 'sm' },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
